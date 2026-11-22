"""Conscious Spending Plan (CSP) worksheet AI tools.

Enables Uzi to view, add, update, and delete planned monthly or annual expenses
(e.g., annual rent of 28jt prorated to 2.33jt/mo), set Net Income, and provide
instant Ramit Sethi 4-bucket ratio analysis and cut/earn recommendations.
"""

from __future__ import annotations

import json
from typing import Any

from backend.ai.tools.registry import tool
from backend.services import csp_track


@tool(
    "get_csp_plan",
    description=(
        "Get the user's Conscious Spending Plan (CSP / Track) worksheet: Net Income, planned "
        "expenses list (monthly & annual prorated), 4-bucket ratio breakdown against Ramit Sethi "
        "benchmarks (Fixed Costs 50-60%, Investments 10%+, Savings 5-10%, Guilt-Free 20-35%), "
        "and diagnostic recommendations on what to cut or how much income to increase."
    ),
    input_schema={
        "type": "object",
        "properties": {},
        "required": [],
    },
)
async def get_csp_plan_tool(input_data: dict) -> tuple[str, dict | None]:
    plan = csp_track.get_csp_plan()
    return json.dumps(plan), None


@tool(
    "add_csp_planned_expense",
    description=(
        "CRITICAL: ALWAYS call this tool when the user asks to add, record, or plan an expense in TRACK "
        "or Conscious Spending Plan (e.g. 'tambah data track', 'catat ke track', 'pengeluaran 28jt per tahun', 'kontrakan 25 januari 2027'). "
        "NEVER route Track requests to budget plan, envelope budgeting, or ledger! "
        "Records planned monthly or annual expenses in Track. For annual expenses (e.g. kontrakan 28jt/tahun, "
        "car insurance, tuition), specify frequency='annual' so it is automatically prorated into monthly fixed costs (/12 = 2.33jt/mo). "
        "Returns the saved item, updated bucket totals, percentages, financial health score (Healthy, Over, etc.), and diagnosis."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Descriptive name of the expense (e.g. 'Kontrakan Rumah', 'Listrik PLN', 'Gym', 'Netflix')",
            },
            "amount": {
                "description": "Nominal amount in base currency (e.g. 28000000 or '28jt' or '28.000.000')",
            },
            "frequency": {
                "type": "string",
                "description": "Payment frequency: 'monthly' (regular monthly bill) or 'annual' (yearly payment prorated by /12)",
                "default": "monthly",
            },
            "bucket": {
                "type": "string",
                "description": (
                    "Conscious Spending Plan bucket: 'fixed_costs', 'investments', 'savings', or 'guilt_free'. "
                    "If omitted, auto-classified."
                ),
            },
            "due_date": {
                "type": "string",
                "description": "Optional due date or next payment date (e.g. '2027-01-25')",
            },
            "notes": {
                "type": "string",
                "description": "Optional notes or context about this planned expense",
            },
        },
        "required": ["name", "amount"],
    },
)
async def add_csp_planned_expense_tool(input_data: dict) -> tuple[str, dict | None]:
    name = str(input_data.get("name") or "").strip()
    if not name:
        notes = str(input_data.get("notes") or "").strip()
        name = notes if notes else "Planned Expense"

    amount = csp_track.parse_amount(input_data.get("amount", 0.0))
    frequency = csp_track.normalize_frequency(input_data.get("frequency"))
    bucket = input_data.get("bucket")
    due_date = input_data.get("due_date")
    notes = input_data.get("notes")

    record = csp_track.add_or_update_planned_expense({
        "name": name,
        "amount": amount,
        "frequency": frequency,
        "bucket": bucket,
        "due_date": due_date,
        "notes": notes,
    })

    plan = csp_track.get_csp_plan()
    return json.dumps({
        "saved_expense": record,
        "updated_plan_summary": {
            "net_income": plan["net_income"],
            "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
            "bucket_totals": {k: b["monthly_total"] for k, b in plan["buckets"].items()},
            "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
            "score": plan.get("score"),
            "diagnoses": plan["diagnoses"],
        },
    }), None


@tool(
    "delete_csp_planned_expense",
    description="Remove a planned expense from the Conscious Spending Plan (Track tab) by its id or name.",
    input_schema={
        "type": "object",
        "properties": {
            "expense_id": {
                "type": "string",
                "description": "The unique ID of the planned expense (e.g. 'plan_a1b2c3d4')",
            },
            "name": {
                "type": "string",
                "description": "The name of the planned expense to delete (e.g. 'Kontrakan')",
            },
        },
    },
)
async def delete_csp_planned_expense_tool(input_data: dict) -> tuple[str, dict | None]:
    expense_id = input_data.get("expense_id")
    name = input_data.get("name")
    deleted = csp_track.delete_planned_expense(expense_id=expense_id, name=name)
    plan = csp_track.get_csp_plan()
    return json.dumps({
        "deleted": deleted,
        "updated_plan_summary": {
            "net_income": plan["net_income"],
            "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
            "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
            "score": plan.get("score"),
        },
    }), None


@tool(
    "set_csp_income",
    description=(
        "Set or update the user's monthly Take-Home Net Income for Conscious Spending Plan (CSP / Track) "
        "ratio calculations and diagnosis. Useful when income transactions haven't been imported yet or "
        "to simulate different salary levels."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "monthly_net_income": {
                "description": "Monthly take-home pay in base currency (e.g. 15000000 or '15jt')",
            },
        },
        "required": ["monthly_net_income"],
    },
)
async def set_csp_income_tool(input_data: dict) -> tuple[str, dict | None]:
    income = csp_track.parse_amount(input_data.get("monthly_net_income", 0.0))
    csp_track.update_csp_config({"custom_monthly_income": income})
    plan = csp_track.get_csp_plan()
    return json.dumps({
        "net_income": plan["net_income"],
        "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
        "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
        "score": plan.get("score"),
        "diagnoses": plan["diagnoses"],
    }), None


@tool(
    "add_csp_planned_income",
    description=(
        "Record or add a planned income source to Track / Conscious Spending Plan (e.g. 'tambah income gaji 15jt/bulan', "
        "'tambah pemasukan freelance 5jt', 'tambah bonus tahunan 24jt/tahun'). "
        "Allows multiple income streams to be tracked and totaled up automatically. For annual income (e.g. bonus, dividends), "
        "specify frequency='annual' so it is prorated into monthly income (/12 = 2jt/mo)."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Descriptive name of the income stream (e.g. 'Gaji Pokok', 'Freelance Web', 'Dividen Saham')",
            },
            "amount": {
                "description": "Nominal amount in base currency (e.g. 15000000 or '15jt' or '15.000.000')",
            },
            "frequency": {
                "type": "string",
                "description": "Frequency: 'monthly' (regular monthly pay) or 'annual' (yearly bonus/dividends prorated by /12)",
                "default": "monthly",
            },
            "notes": {
                "type": "string",
                "description": "Optional notes about this income stream",
            },
        },
        "required": ["name", "amount"],
    },
)
async def add_csp_planned_income_tool(input_data: dict) -> tuple[str, dict | None]:
    name = str(input_data.get("name") or "").strip()
    if not name:
        notes = str(input_data.get("notes") or "").strip()
        name = notes if notes else "Income Source"

    amount = csp_track.parse_amount(input_data.get("amount", 0.0))
    frequency = csp_track.normalize_frequency(input_data.get("frequency"))
    notes = input_data.get("notes")

    record = csp_track.add_or_update_planned_income({
        "name": name,
        "amount": amount,
        "frequency": frequency,
        "notes": notes,
    })

    plan = csp_track.get_csp_plan()
    return json.dumps({
        "saved_income": record,
        "total_net_income": plan["net_income"],
        "planned_incomes": plan.get("planned_incomes", []),
        "updated_plan_summary": {
            "net_income": plan["net_income"],
            "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
            "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
            "score": plan.get("score"),
            "diagnoses": plan["diagnoses"],
        },
    }), None


@tool(
    "delete_csp_planned_income",
    description="Remove a planned income source from Track (Conscious Spending Plan) by its id or name.",
    input_schema={
        "type": "object",
        "properties": {
            "income_id": {
                "type": "string",
                "description": "The unique ID of the planned income stream (e.g. 'inc_a1b2c3d4')",
            },
            "name": {
                "type": "string",
                "description": "The name of the income source to delete (e.g. 'Freelance')",
            },
        },
    },
)
async def delete_csp_planned_income_tool(input_data: dict) -> tuple[str, dict | None]:
    income_id = input_data.get("income_id")
    name = input_data.get("name")
    deleted = csp_track.delete_planned_income(income_id=income_id, name=name)
    plan = csp_track.get_csp_plan()
    return json.dumps({
        "deleted": deleted,
        "total_net_income": plan["net_income"],
        "planned_incomes": plan.get("planned_incomes", []),
        "updated_plan_summary": {
            "net_income": plan["net_income"],
            "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
            "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
            "score": plan.get("score"),
        },
    }), None
