"""
csp_track — Conscious Spending Plan (CSP) tracking service (Ramit Sethi framework).

Computes real-time Conscious Spending Plan metrics for a given month:
1. Net Income (Take-Home Pay)
2. Fixed Costs (Target: 50%–60%, with optional 15% unexpected expense buffer)
3. Investments (Target: 10%+)
4. Savings Goals (Target: 5%–10%)
5. Guilt-Free Spending (Target: 20%–35%)

Calculates the prominent "Guilt-Free Spending Remaining" (Sisa Uang Jajan Bebas Rasa Bersalah)
so users can spend guilt-free once necessities, investments, and savings goals are covered.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from backend.core.fx import base_currency, txn_split_base_amount
from backend.core.user_time import user_today
from backend.db.account_store import AccountStore
from backend.db.payload_store import NamespacedSettingsStore
from backend.services import categories as categories_service
from backend.services import ledger as ledger_service
from backend.services import profile as profile_service
from backend.services.fx_cache import load_fx_cache

# Bucket definitions & Ramit Sethi target guidance
BUCKETS: dict[str, dict[str, Any]] = {
    "fixed_costs": {
        "key": "fixed_costs",
        "label": "Fixed Costs",
        "description": "Biaya hidup pokok: sewa/KPR, listrik, air, internet, belanja dapur, transportasi dasar, asuransi, cicilan hutang.",
        "target_min": 50.0,
        "target_max": 60.0,
        "color": "#3b86dd",  # Blue
    },
    "investments": {
        "key": "investments",
        "label": "Investments",
        "description": "Investasi jangka panjang untuk masa depan: reksadana, saham, ETF, crypto, dana pensiun.",
        "target_min": 10.0,
        "target_max": 100.0,
        "color": "#10b981",  # Green
    },
    "savings": {
        "key": "savings",
        "label": "Savings Goals",
        "description": "Tabungan target spesifik: dana darurat, liburan, DP rumah, renovasi, kado/hadiah.",
        "target_min": 5.0,
        "target_max": 10.0,
        "color": "#f59e0b",  # Amber / Yellow
    },
    "guilt_free": {
        "key": "guilt_free",
        "label": "Guilt-Free Spending",
        "description": "Uang jajan bebas rasa bersalah: kulineran, ngopi, nonton, shopping, hobi, liburan santai, langganan hiburan.",
        "target_min": 20.0,
        "target_max": 35.0,
        "color": "#8b5cf6",  # Purple
    },
}

# Smart keywords for auto-classifying categories into the 4 buckets
_KEYWORD_PATTERNS: list[tuple[str, list[str]]] = [
    (
        "investments",
        [
            "invest", "saham", "stock", "crypto", "kripto", "bitcoin", "reksadana",
            "mutual fund", "etf", "retirement", "pensiun", "dplk", "rsu", "deposito",
            "rdn", "bibit", "ajaib", "bareksa", "pluang", "stockbit", "broker",
        ],
    ),
    (
        "savings",
        [
            "save", "saving", "tabungan", "emergency", "darurat", "dana darurat",
            "vacation", "liburan", "holiday", "target", "goal", "dp rumah",
            "kado", "hadiah", "wedding", "nikah", "renovasi",
        ],
    ),
    (
        "fixed_costs",
        [
            "rent", "mortgage", "kpr", "sewa", "kontrak", "utilit", "listrik", "air",
            "pdam", "internet", "wifi", "phone", "pulsa", "paket data", "grocer",
            "sembako", "belanja dapur", "supermarket", "pasar", "insurance", "asuransi",
            "bpjs", "debt", "cicilan", "hutang", "loan", "tax", "pajak", "pbb",
            "medical", "dokter", "obat", "rumahsakit", "sekolah", "tuition", "spp",
            "maintenance", "servis", "service", "bensin", "fuel", "gas", "transport",
            "parkir", "tol", "bill", "tagihan", "needs", "need",
        ],
    ),
]


def _get_settings_store() -> NamespacedSettingsStore:
    return NamespacedSettingsStore("csp_track")


def classify_category(category_id: str | None, category_label: str, overrides: dict[str, str]) -> str:
    """Classifies a category into one of the 4 Conscious Spending Plan buckets."""
    if category_id and category_id in overrides:
        bucket = overrides[category_id]
        if bucket in BUCKETS:
            return bucket

    label_lower = (category_label or "").lower()

    for bucket, keywords in _KEYWORD_PATTERNS:
        for kw in keywords:
            if kw in label_lower:
                return bucket

    # Default for all other discretionary spending is guilt_free
    return "guilt_free"


def get_csp_tracking(month: str | None = None) -> dict[str, Any]:
    """Computes the Conscious Spending Plan tracking data for the requested month (YYYY-MM)."""
    today = user_today()
    if not month or not re.match(r"^\d{4}-\d{2}$", month):
        month = today.strftime("%Y-%m")

    base = base_currency()
    rates = load_fx_cache()
    settings = _get_settings_store().get() or {}
    overrides: dict[str, str] = settings.get("category_mappings", {})
    unexpected_buffer_enabled: bool = bool(settings.get("unexpected_buffer_enabled", True))
    custom_income: float | None = settings.get("custom_monthly_income")

    # Categories map
    all_cats = categories_service.all_category_rows()
    cat_by_id = {c["id"]: c for c in all_cats}

    # Fetch accounts to detect investment/retirement accounts for transfers
    accts = AccountStore().query_accounts()
    acct_by_id = {a["id"]: a for a in accts}

    # All non-deleted transactions for the target month
    all_txns = ledger_service.transactions.all()
    month_txns = []
    total_income = 0.0

    bucket_data: dict[str, dict[str, Any]] = {
        k: {
            **meta,
            "actual_spent": 0.0,
            "actual_pct": 0.0,
            "categories": {},  # cat_id -> {id, label, color, spent, count}
            "transactions": [],
            "status": "neutral",
        }
        for k, meta in BUCKETS.items()
    }

    for t in all_txns:
        if t.get("deleted"):
            continue
        t_date = (t.get("date") or "")[:10]
        if not t_date.startswith(month):
            continue

        kind = t.get("kind")
        if kind == "income":
            splits = t.get("splits")
            if splits:
                for s in splits:
                    total_income += txn_split_base_amount(t, s, base, rates)
            else:
                total_income += ledger_service.txn_base_amount(t, base, rates)
            continue

        if kind == "expense":
            splits = t.get("splits")
            if splits:
                for s in splits:
                    amt = txn_split_base_amount(t, s, base, rates)
                    cid = s.get("category")
                    clabel = (cat_by_id.get(cid, {}).get("label") or "Uncategorized") if cid else "Uncategorized"
                    ccolor = (cat_by_id.get(cid, {}).get("color") or "") if cid else ""
                    bucket = classify_category(cid, clabel, overrides)
                    b_entry = bucket_data[bucket]
                    b_entry["actual_spent"] += amt
                    if cid not in b_entry["categories"]:
                        b_entry["categories"][cid] = {
                            "id": cid,
                            "label": clabel,
                            "color": ccolor,
                            "spent": 0.0,
                            "count": 0,
                        }
                    b_entry["categories"][cid]["spent"] += amt
                    b_entry["categories"][cid]["count"] += 1
            else:
                amt = ledger_service.txn_base_amount(t, base, rates)
                cid = t.get("category")
                clabel = (cat_by_id.get(cid, {}).get("label") or "Uncategorized") if cid else "Uncategorized"
                ccolor = (cat_by_id.get(cid, {}).get("color") or "") if cid else ""
                bucket = classify_category(cid, clabel, overrides)
                b_entry = bucket_data[bucket]
                b_entry["actual_spent"] += amt
                if cid not in b_entry["categories"]:
                    b_entry["categories"][cid] = {
                        "id": cid,
                        "label": clabel,
                        "color": ccolor,
                        "spent": 0.0,
                        "count": 0,
                    }
                b_entry["categories"][cid]["spent"] += amt
                b_entry["categories"][cid]["count"] += 1

            month_txns.append({
                "id": t.get("id"),
                "date": t_date,
                "payee": t.get("payee") or "Expense",
                "notes": t.get("notes") or "",
                "amount": round(ledger_service.txn_base_amount(t, base, rates), 2),
                "bucket": classify_category(
                    t.get("category"),
                    cat_by_id.get(t.get("category"), {}).get("label") or "",
                    overrides,
                ),
                "category_label": cat_by_id.get(t.get("category"), {}).get("label") or "Uncategorized",
            })

        # Transfer treatment: transfer from cash to investment/retirement counts as investment
        elif kind == "transfer":
            to_acc_id = t.get("to_account_id") or t.get("account_id")
            to_acc = acct_by_id.get(to_acc_id)
            if to_acc and to_acc.get("type") in ("investment", "retirement"):
                amt = ledger_service.txn_base_amount(t, base, rates)
                b_entry = bucket_data["investments"]
                b_entry["actual_spent"] += amt
                inv_cid = "transfer_investment"
                if inv_cid not in b_entry["categories"]:
                    b_entry["categories"][inv_cid] = {
                        "id": inv_cid,
                        "label": f"Transfer to {to_acc.get('name', 'Investments')}",
                        "color": "#10b981",
                        "spent": 0.0,
                        "count": 0,
                    }
                b_entry["categories"][inv_cid]["spent"] += amt
                b_entry["categories"][inv_cid]["count"] += 1
                month_txns.append({
                    "id": t.get("id"),
                    "date": t_date,
                    "payee": f"Transfer → {to_acc.get('name', 'Investments')}",
                    "notes": t.get("notes") or "",
                    "amount": round(amt, 2),
                    "bucket": "investments",
                    "category_label": "Investments",
                })

    # Determine Take-Home Net Income
    net_income = total_income
    income_source = "transactions"
    if custom_income and custom_income > 0:
        net_income = custom_income
        income_source = "custom"
    elif net_income <= 0:
        profile = profile_service.read_profile() or {}
        p_inc = profile.get("monthly_net_income")
        if p_inc and float(p_inc) > 0:
            net_income = float(p_inc)
            income_source = "profile"
        else:
            total_expenses = sum(b["actual_spent"] for b in bucket_data.values())
            if total_expenses > 0:
                net_income = total_expenses
                income_source = "spending_fallback"
            else:
                net_income = 0.0
                income_source = "zero"

    # Compute percentages and status for each bucket
    total_spent = 0.0
    for key, b in bucket_data.items():
        spent = round(b["actual_spent"], 2)
        b["actual_spent"] = spent
        total_spent += spent
        pct = round((spent / net_income * 100.0), 1) if net_income > 0 else 0.0
        b["actual_pct"] = pct

        # Format category list
        cat_list = list(b["categories"].values())
        for c in cat_list:
            c["spent"] = round(c["spent"], 2)
            c["pct_of_income"] = round((c["spent"] / net_income * 100.0), 1) if net_income > 0 else 0.0
        cat_list.sort(key=lambda x: x["spent"], reverse=True)
        b["categories"] = cat_list
        b["transactions_count"] = sum(c["count"] for c in cat_list)

        # Status determination
        if key == "fixed_costs":
            if pct <= b["target_max"]:
                b["status"] = "good"
            elif pct <= b["target_max"] + 5.0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"
        elif key == "investments":
            if pct >= b["target_min"]:
                b["status"] = "good"
            elif pct > 0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"
        elif key == "savings":
            if pct >= b["target_min"]:
                b["status"] = "good"
            elif pct > 0:
                b["status"] = "warning"
            else:
                b["status"] = "neutral"
        elif key == "guilt_free":
            if pct <= b["target_max"]:
                b["status"] = "good"
            elif pct <= b["target_max"] + 5.0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"

    # Ramit Sethi Unexpected Expense Buffer: 15% of Fixed Costs
    fixed_spent = bucket_data["fixed_costs"]["actual_spent"]
    unexpected_buffer = round(fixed_spent * 0.15, 2) if unexpected_buffer_enabled else 0.0

    # Guilt-Free Allowance:
    # Net Income - (Fixed Costs + 15% Buffer + Investments Target/Actual + Savings Target/Actual)
    # Target allocations in money terms:
    invest_nominal = max(
        bucket_data["investments"]["actual_spent"],
        net_income * (bucket_data["investments"]["target_min"] / 100.0),
    )
    savings_nominal = max(
        bucket_data["savings"]["actual_spent"],
        net_income * (bucket_data["savings"]["target_min"] / 100.0),
    )
    fixed_total_committed = fixed_spent + unexpected_buffer

    guilt_free_allowance = max(
        0.0,
        round(net_income - (fixed_total_committed + invest_nominal + savings_nominal), 2),
    )
    # Default to 20% of net_income if commits exceed income
    if guilt_free_allowance <= 0 and net_income > 0:
        guilt_free_allowance = round(net_income * 0.20, 2)

    guilt_free_spent = bucket_data["guilt_free"]["actual_spent"]
    guilt_free_remaining = round(guilt_free_allowance - guilt_free_spent, 2)

    # Health status for Guilt-Free Remaining
    if guilt_free_remaining > (guilt_free_allowance * 0.25):
        guilt_free_status = "good"
    elif guilt_free_remaining >= 0:
        guilt_free_status = "warning"
    else:
        guilt_free_status = "danger"

    unallocated = round(net_income - total_spent, 2)

    # Sort recent transactions by date desc
    month_txns.sort(key=lambda x: x["date"], reverse=True)

    # Categories catalog for mapping UI
    categories_catalog = [
        {
            "id": c["id"],
            "label": c.get("label") or c["id"],
            "color": c.get("color") or "#7c8595",
            "current_bucket": classify_category(c["id"], c.get("label") or "", overrides),
        }
        for c in all_cats
        if c.get("kind") in ("expense", "transfer")
    ]

    return {
        "month": month,
        "base_currency": base,
        "net_income": round(net_income, 2),
        "net_income_source": income_source,
        "total_spent": round(total_spent, 2),
        "unallocated": unallocated,
        "guilt_free_allowance": guilt_free_allowance,
        "guilt_free_spent": guilt_free_spent,
        "guilt_free_remaining": guilt_free_remaining,
        "guilt_free_status": guilt_free_status,
        "unexpected_buffer": unexpected_buffer,
        "unexpected_buffer_enabled": unexpected_buffer_enabled,
        "buckets": bucket_data,
        "recent_transactions": month_txns[:30],
        "category_mappings": overrides,
        "categories_catalog": categories_catalog,
    }


def update_csp_config(payload: dict[str, Any]) -> dict[str, Any]:
    """Updates custom Conscious Spending Plan settings (mappings, buffers, custom income)."""
    store = _get_settings_store()
    current = store.get() or {}

    if "category_mappings" in payload and isinstance(payload["category_mappings"], dict):
        current["category_mappings"] = {
            str(k): str(v)
            for k, v in payload["category_mappings"].items()
            if v in BUCKETS
        }

    if "unexpected_buffer_enabled" in payload:
        current["unexpected_buffer_enabled"] = bool(payload["unexpected_buffer_enabled"])

    if "custom_monthly_income" in payload:
        val = payload["custom_monthly_income"]
        current["custom_monthly_income"] = float(val) if val is not None and float(val) > 0 else None

    store.save(current)
    return current
