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
        "Add or update a planned monthly or annual expense in the user's Conscious Spending Plan "
        "(Track tab). For annual expenses (e.g., rent/kontrakan 28jt per year, annual car insurance, "
        "or tuition), specify frequency='annual' so it is automatically prorated into monthly "
        "fixed costs (e.g. 28jt/12 = 2.33jt/mo). Returns the saved item, updated bucket totals, "
        "percentages, and diagnosis."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Descriptive name of the expense (e.g. 'Kontrakan Rumah', 'Listrik PLN', 'Gym', 'Netflix')",
            },
            "amount": {
                "type": "number",
                "description": "Nominal amount in base currency (e.g. 28000000 for 28jt)",
            },
            "frequency": {
                "type": "string",
                "enum": ["monthly", "annual"],
                "description": "Payment frequency: 'monthly' (regular monthly bill) or 'annual' (yearly payment prorated by /12)",
                "default": "monthly",
            },
            "bucket": {
                "type": "string",
                "enum": ["fixed_costs", "investments", "savings", "guilt_free"],
                "description": (
                    "Conscious Spending Plan bucket. 'fixed_costs': rent/mortgage, utilities, groceries, debt. "
                    "'investments': index funds, stocks, crypto, retirement. 'savings': emergency fund, vacation, gifts. "
                    "'guilt_free': dining out, entertainment, shopping. If omitted, auto-classified."
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
    amount = float(input_data.get("amount", 0.0))
    frequency = str(input_data.get("frequency") or "monthly").lower().strip()
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
                "type": "number",
                "description": "Monthly take-home pay in base currency (e.g. 15000000 for 15jt)",
            },
        },
        "required": ["monthly_net_income"],
    },
)
async def set_csp_income_tool(input_data: dict) -> tuple[str, dict | None]:
    income = float(input_data.get("monthly_net_income", 0.0))
    csp_track.update_csp_config({"custom_monthly_income": income})
    plan = csp_track.get_csp_plan()
    return json.dumps({
        "net_income": plan["net_income"],
        "bucket_percentages": {k: b["pct_of_income"] for k, b in plan["buckets"].items()},
        "surplus_or_deficit": plan["summary"]["surplus_or_deficit"],
        "diagnoses": plan["diagnoses"],
    }), None
