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
import uuid
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
        "description": "Essential living expenses: rent/mortgage, utilities, groceries, basic transport, insurance, and debt payments.",
        "target_min": 50.0,
        "target_max": 60.0,
        "color": "#3b86dd",  # Blue
    },
    "investments": {
        "key": "investments",
        "label": "Investments",
        "description": "Long-term wealth building: mutual funds, index funds, stocks, crypto, retirement, and pension accounts.",
        "target_min": 10.0,
        "target_max": 100.0,
        "color": "#10b981",  # Green
    },
    "savings": {
        "key": "savings",
        "label": "Savings Goals",
        "description": "Targeted savings goals: emergency fund, vacations, down payment, home repairs, and gifts.",
        "target_min": 5.0,
        "target_max": 10.0,
        "color": "#f59e0b",  # Amber / Yellow
    },
    "guilt_free": {
        "key": "guilt_free",
        "label": "Guilt-Free Spending",
        "description": "Guilt-free spending: dining out, drinks, entertainment, shopping, hobbies, streaming, and personal splurges.",
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


def parse_amount(val: Any) -> float:
    """Robustly parse numeric or formatted string amounts (e.g. '28jt', '28.000.000', '2.5jt')."""
    if isinstance(val, (int, float)):
        return float(val)
    if not val:
        return 0.0
    s = str(val).strip().lower()
    mult = 1.0
    if "jt" in s or "juta" in s:
        mult = 1_000_000.0
        s = re.sub(r"(jt|juta)", "", s)
    elif "rb" in s or "ribu" in s:
        mult = 1_000.0
        s = re.sub(r"(rb|ribu)", "", s)
    elif s.endswith("m") and not s.endswith("am") and not s.endswith("pm"):
        mult = 1_000_000.0
        s = s[:-1]
    elif s.endswith("k"):
        mult = 1_000.0
        s = s[:-1]

    # Strip currency indicators
    s = re.sub(r"^(rp|idr|\$|€|£)", "", s).strip()
    if s.count(".") > 1:
        s = s.replace(".", "")
    elif s.count(",") > 1:
        s = s.replace(",", "")
    elif s.count(".") == 1 and s.count(",") == 1:
        if s.find(".") < s.find(","):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif s.count(".") == 1:
        parts = s.split(".")
        if len(parts[1]) == 3 and mult == 1.0:
            s = s.replace(".", "")
    elif s.count(",") == 1:
        parts = s.split(",")
        if len(parts[1]) == 3 and mult == 1.0:
            s = s.replace(",", "")
        else:
            s = s.replace(",", ".")

    try:
        return round(float(s.strip()) * mult, 2)
    except (ValueError, TypeError):
        return 0.0


def normalize_frequency(val: Any) -> str:
    """Normalize frequency string: annual/yearly/tahunan/per tahun -> 'annual', else 'monthly'."""
    s = str(val or "").strip().lower()
    if any(k in s for k in ("annual", "year", "thn", "tahun")):
        return "annual"
    if re.search(r"\bth\b", s) or "/th" in s or "/yr" in s:
        return "annual"
    return "monthly"


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

    plan_data = get_csp_plan()
    planned_in_month = []
    for item in plan_data.get("planned_expenses", []):
        d = item.get("due_date")
        if d and str(d).startswith(month):
            planned_in_month.append(item)

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
        "plan": plan_data,
        "planned_in_month": planned_in_month,
    }


def get_planned_expenses() -> list[dict[str, Any]]:
    """Returns the list of user-defined planned expenses with computed prorated monthly amounts."""
    store = _get_settings_store()
    settings = store.get() or {}
    raw_list = settings.get("planned_expenses", [])
    if not isinstance(raw_list, list):
        return []

    overrides = settings.get("category_mappings", {})
    cleaned = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id") or f"plan_{uuid.uuid4().hex[:8]}")
        name = str(item.get("name") or "Unnamed Planned Expense").strip()
        amt = parse_amount(item.get("amount") or 0.0)
        freq = normalize_frequency(item.get("frequency"))

        # Prorating: annual is divided by 12 to get monthly equivalent
        if freq == "annual":
            monthly_amt = round(amt / 12.0, 2)
            annual_amt = round(amt, 2)
        else:
            monthly_amt = round(amt, 2)
            annual_amt = round(amt * 12.0, 2)

        bucket = str(item.get("bucket") or "").lower().strip()
        if bucket not in BUCKETS:
            bucket = classify_category(item.get("category_id"), name, overrides)

        cleaned.append({
            "id": item_id,
            "name": name,
            "amount": amt,
            "frequency": freq,
            "monthly_amount": monthly_amt,
            "annual_amount": annual_amt,
            "bucket": bucket,
            "category_id": item.get("category_id"),
            "category_label": item.get("category_label"),
            "due_date": item.get("due_date"),
            "notes": item.get("notes") or "",
        })
    return cleaned


def add_or_update_planned_expense(payload: dict[str, Any]) -> dict[str, Any]:
    """Adds a new planned expense or updates an existing one in the CSP worksheet."""
    store = _get_settings_store()
    current = store.get() or {}
    expenses = current.get("planned_expenses", [])
    if not isinstance(expenses, list):
        expenses = []

    name = str(payload.get("name") or "").strip()
    if not name:
        notes = str(payload.get("notes") or "").strip()
        name = notes if notes else "Planned Expense"

    amt = parse_amount(payload.get("amount", 0.0))
    if amt < 0:
        raise ValueError("Amount cannot be negative.")

    freq = normalize_frequency(payload.get("frequency"))

    overrides = current.get("category_mappings", {})
    bucket = str(payload.get("bucket") or "").lower().strip()
    if bucket not in BUCKETS:
        bucket = classify_category(payload.get("category_id"), name, overrides)

    if freq == "annual":
        monthly_amt = round(amt / 12.0, 2)
        annual_amt = round(amt, 2)
    else:
        monthly_amt = round(amt, 2)
        annual_amt = round(amt * 12.0, 2)

    item_id = payload.get("id")
    target_idx = None
    if item_id:
        for idx, ex in enumerate(expenses):
            if isinstance(ex, dict) and ex.get("id") == item_id:
                target_idx = idx
                break
    else:
        for idx, ex in enumerate(expenses):
            if isinstance(ex, dict) and str(ex.get("name", "")).strip().lower() == name.lower():
                target_idx = idx
                item_id = ex.get("id")
                break

    if not item_id:
        item_id = f"plan_{uuid.uuid4().hex[:8]}"

    record = {
        "id": item_id,
        "name": name,
        "amount": amt,
        "frequency": freq,
        "monthly_amount": monthly_amt,
        "annual_amount": annual_amt,
        "bucket": bucket,
        "category_id": payload.get("category_id"),
        "category_label": payload.get("category_label"),
        "due_date": payload.get("due_date"),
        "notes": payload.get("notes") or "",
    }

    if target_idx is not None:
        expenses[target_idx] = record
    else:
        expenses.append(record)

    current["planned_expenses"] = expenses
    store.save(current)
    return record

    current["planned_expenses"] = expenses
    store.save(current)
    return record


def delete_planned_expense(expense_id: str | None = None, name: str | None = None) -> bool:
    """Deletes a planned expense by id or name."""
    store = _get_settings_store()
    current = store.get() or {}
    expenses = current.get("planned_expenses", [])
    if not isinstance(expenses, list):
        return False

    initial_len = len(expenses)
    if expense_id:
        expenses = [e for e in expenses if isinstance(e, dict) and e.get("id") != expense_id]
    elif name:
        target_name = name.strip().lower()
        expenses = [
            e for e in expenses
            if isinstance(e, dict) and str(e.get("name", "")).strip().lower() != target_name
        ]

    if len(expenses) != initial_len:
        current["planned_expenses"] = expenses
        store.save(current)
        return True
    return False


def get_csp_plan() -> dict[str, Any]:
    """Computes the Conscious Spending Plan Worksheet: planned items, live bucket ratios,

    unexpected expense buffer, and Ramit Sethi diagnosis recommendations.
    """
    base = base_currency()
    store = _get_settings_store()
    settings = store.get() or {}
    custom_income = settings.get("custom_monthly_income")
    unexpected_buffer_enabled = bool(settings.get("unexpected_buffer_enabled", True))

    # Determine Net Income
    net_income = 0.0
    income_source = "zero"
    if custom_income and float(custom_income) > 0:
        net_income = float(custom_income)
        income_source = "custom"
    else:
        profile = profile_service.read_profile() or {}
        p_inc = profile.get("monthly_net_income")
        if p_inc and float(p_inc) > 0:
            net_income = float(p_inc)
            income_source = "profile"

    items = get_planned_expenses()

    # Buckets structure
    bucket_map: dict[str, dict[str, Any]] = {
        k: {
            **meta,
            "items": [],
            "monthly_subtotal": 0.0,
            "monthly_total": 0.0,
            "pct_of_income": 0.0,
            "status": "neutral",
        }
        for k, meta in BUCKETS.items()
    }

    for it in items:
        b_key = it["bucket"]
        if b_key not in bucket_map:
            b_key = "fixed_costs"
        bucket_map[b_key]["items"].append(it)
        bucket_map[b_key]["monthly_subtotal"] += it["monthly_amount"]

    # Round subtotals
    for b in bucket_map.values():
        b["monthly_subtotal"] = round(b["monthly_subtotal"], 2)
        b["monthly_total"] = b["monthly_subtotal"]

    # Fixed Costs 15% unexpected buffer
    fixed_subtotal = bucket_map["fixed_costs"]["monthly_subtotal"]
    unexpected_buffer = round(fixed_subtotal * 0.15, 2) if unexpected_buffer_enabled else 0.0
    bucket_map["fixed_costs"]["unexpected_buffer"] = unexpected_buffer
    bucket_map["fixed_costs"]["monthly_total"] = round(fixed_subtotal + unexpected_buffer, 2)

    # If income is not set, fallback to total planned monthly expenses so percentages don't divide by 0
    total_planned = sum(b["monthly_total"] for b in bucket_map.values())
    if net_income <= 0 and total_planned > 0:
        net_income = total_planned
        income_source = "planned_fallback"

    # Compute percentages & health status
    for k, b in bucket_map.items():
        pct = round((b["monthly_total"] / net_income * 100.0), 1) if net_income > 0 else 0.0
        b["pct_of_income"] = pct

        if k == "fixed_costs":
            if pct <= b["target_max"]:
                b["status"] = "good"
            elif pct <= b["target_max"] + 5.0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"
        elif k == "investments":
            if pct >= b["target_min"]:
                b["status"] = "good"
            elif pct > 0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"
        elif k == "savings":
            if pct >= b["target_min"]:
                b["status"] = "good"
            elif pct > 0:
                b["status"] = "warning"
            else:
                b["status"] = "neutral"
        elif k == "guilt_free":
            if pct <= b["target_max"]:
                b["status"] = "good"
            elif pct <= b["target_max"] + 5.0:
                b["status"] = "warning"
            else:
                b["status"] = "danger"

    total_planned_monthly = round(total_planned, 2)
    surplus_or_deficit = round(net_income - total_planned_monthly, 2)

    # Guilt-Free Allowance: Net Income - (Fixed Costs Total + Investments + Savings)
    guilt_free_allowance = max(
        0.0,
        round(
            net_income
            - (
                bucket_map["fixed_costs"]["monthly_total"]
                + bucket_map["investments"]["monthly_total"]
                + bucket_map["savings"]["monthly_total"]
            ),
            2,
        ),
    )
    guilt_free_remaining = round(guilt_free_allowance - bucket_map["guilt_free"]["monthly_total"], 2)

    # Diagnoses & Action Recommendations
    diagnoses: list[dict[str, Any]] = []

    fixed_pct = bucket_map["fixed_costs"]["pct_of_income"]
    fixed_total = bucket_map["fixed_costs"]["monthly_total"]
    if fixed_pct > 60.0 and net_income > 0:
        target_fixed = round(net_income * 0.60, 2)
        excess = round(fixed_total - target_fixed, 2)
        income_needed = round((fixed_total / 0.60) - net_income, 2)
        diagnoses.append({
            "bucket": "fixed_costs",
            "severity": "danger",
            "title": "Fixed Costs Exceed Target (50%–60%)",
            "message": (
                f"Fixed costs are at {fixed_pct:.1f}% ({base} {fixed_total:,.0f}/mo). "
                "Ramit Sethi recommends keeping fixed costs strictly between 50%–60% of take-home pay."
            ),
            "action": (
                f"To reach the 60% ceiling, you need to cut fixed costs by {base} {excess:,.0f}/mo, "
                f"or increase monthly take-home income by {base} {income_needed:,.0f}/mo."
            ),
        })
    elif fixed_pct < 50.0 and net_income > 0 and fixed_total > 0:
        diagnoses.append({
            "bucket": "fixed_costs",
            "severity": "good",
            "title": "Fixed Costs Well-Controlled",
            "message": f"Fixed costs are lean at {fixed_pct:.1f}%.",
            "action": "You have generous headroom to aggressively invest or boost guilt-free spending.",
        })
    elif 50.0 <= fixed_pct <= 60.0:
        diagnoses.append({
            "bucket": "fixed_costs",
            "severity": "good",
            "title": "Fixed Costs in Sweet Spot",
            "message": f"Fixed costs are ideally balanced at {fixed_pct:.1f}% of take-home pay.",
            "action": "Maintain this baseline as your income grows.",
        })

    invest_pct = bucket_map["investments"]["pct_of_income"]
    invest_total = bucket_map["investments"]["monthly_total"]
    if invest_pct < 10.0 and net_income > 0:
        target_invest = round(net_income * 0.10, 2)
        gap = round(target_invest - invest_total, 2)
        diagnoses.append({
            "bucket": "investments",
            "severity": "warning",
            "title": "Investments Below Target (10%+)",
            "message": f"Currently investing {invest_pct:.1f}% ({base} {invest_total:,.0f}/mo).",
            "action": f"Allocate at least {base} {gap:,.0f} more per month towards index funds or retirement.",
        })
    elif invest_pct >= 10.0:
        diagnoses.append({
            "bucket": "investments",
            "severity": "good",
            "title": "Investments on Track",
            "message": f"Investing {invest_pct:.1f}% compounds into serious long-term wealth.",
            "action": "Continue regular automatic contributions.",
        })

    savings_pct = bucket_map["savings"]["pct_of_income"]
    savings_total = bucket_map["savings"]["monthly_total"]
    if savings_pct < 5.0 and net_income > 0:
        target_save = round(net_income * 0.05, 2)
        gap = round(target_save - savings_total, 2)
        diagnoses.append({
            "bucket": "savings",
            "severity": "warning",
            "title": "Savings Goals Below Target (5%–10%)",
            "message": f"Allocating {savings_pct:.1f}% ({base} {savings_total:,.0f}/mo) to savings goals.",
            "action": f"Add {base} {gap:,.0f}/mo for emergency cushion or large upcoming purchases.",
        })

    if surplus_or_deficit < 0:
        diagnoses.append({
            "bucket": "overall",
            "severity": "danger",
            "title": "Monthly Deficit Detected",
            "message": f"Your planned monthly expenses exceed net income by {base} {abs(surplus_or_deficit):,.0f}.",
            "action": "Cut discretionary spending or renegotiate fixed costs to balance the plan.",
        })
    elif surplus_or_deficit > 0:
        diagnoses.append({
            "bucket": "overall",
            "severity": "good",
            "title": "Surplus Available",
            "message": f"You have {base} {surplus_or_deficit:,.0f}/mo unallocated buffer in your plan.",
            "action": "Direct this surplus toward your emergency fund or investment accounts.",
        })

    # Financial Score calculation (0 - 100)
    score = 100.0
    if net_income <= 0:
        score = 50.0
        grade = "Needs Income"
        verdict = "Set your monthly Net Income to calculate your Conscious Spending Plan score."
    else:
        # Fixed costs penalty if > 60%
        if fixed_pct > 60.0:
            score -= min(35.0, (fixed_pct - 60.0) * 1.8)

        # Investment penalty if < 10%
        inv_pct = bucket_map["investments"]["pct_of_income"]
        if inv_pct < 10.0:
            score -= min(25.0, (10.0 - inv_pct) * 2.5)

        # Savings penalty if < 5%
        sav_pct = bucket_map["savings"]["pct_of_income"]
        if sav_pct < 5.0:
            score -= min(15.0, (5.0 - sav_pct) * 2.0)

        # Deficit penalty
        if surplus_or_deficit < 0:
            score -= 20.0

        score = float(max(10, min(100, round(score))))
        if score >= 85:
            grade = "Excellent"
            verdict = "Outstanding! Your plan meets or exceeds Ramit Sethi's benchmarks across all buckets."
        elif score >= 70:
            grade = "Good"
            verdict = "Solid financial balance with only minor optimizations recommended."
        elif score >= 50:
            grade = "Fair"
            verdict = "Some imbalance detected. Check Fixed Costs and Investments targets."
        else:
            grade = "Needs Attention"
            verdict = "Fixed costs are consuming too much income or spending exceeds take-home pay."

    return {
        "base_currency": base,
        "net_income": round(net_income, 2),
        "net_income_source": income_source,
        "unexpected_buffer_enabled": unexpected_buffer_enabled,
        "planned_expenses": items,
        "buckets": bucket_map,
        "summary": {
            "total_planned_monthly": total_planned_monthly,
            "surplus_or_deficit": surplus_or_deficit,
            "guilt_free_allowance": guilt_free_allowance,
            "guilt_free_remaining": guilt_free_remaining,
        },
        "score": {
            "points": score,
            "grade": grade,
            "verdict": verdict,
        },
        "diagnoses": diagnoses,
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
