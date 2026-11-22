"""
plan_track — Conscious Spending Plan (CSP) tracking API.

Endpoints:
    GET  /api/plan/track         Returns the Conscious Spending Plan tracking data for a month.
    POST /api/plan/track/config  Updates custom category mappings, unexpected buffer toggle, or custom income.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.api.data_change_transport import compute_only
from backend.core.errors import OpenNetWorthError, to_http_status
from backend.services import csp_track

router = APIRouter()


class CspConfigUpdate(BaseModel):
    category_mappings: dict[str, str] | None = Field(
        default=None,
        description="Map of category_id -> bucket ('fixed_costs' | 'investments' | 'savings' | 'guilt_free')",
    )
    unexpected_buffer_enabled: bool | None = Field(
        default=None,
        description="Whether to include the 15% unexpected expense buffer on fixed costs",
    )
    custom_monthly_income: float | None = Field(
        default=None,
        description="Manual take-home pay override if no salary transactions exist",
    )


class PlannedExpensePayload(BaseModel):
    id: str | None = Field(default=None, description="Optional ID when updating an existing item")
    name: str = Field(..., description="Name of the expense (e.g. Rent, Kontrakan, Electricity)")
    amount: float = Field(..., ge=0, description="Nominal amount in base currency")
    frequency: str = Field(default="monthly", description="'monthly' or 'annual'")
    bucket: str | None = Field(
        default=None,
        description="Target bucket ('fixed_costs' | 'investments' | 'savings' | 'guilt_free')",
    )
    category_id: str | None = Field(default=None, description="Optional category reference")
    category_label: str | None = Field(default=None, description="Optional category display label")
    due_date: str | None = Field(default=None, description="Optional due date (YYYY-MM-DD)")
    notes: str | None = Field(default=None, description="Optional notes or details")


class PlannedIncomePayload(BaseModel):
    id: str | None = Field(default=None, description="Optional ID when updating an existing income source")
    name: str = Field(..., description="Name of the income source (e.g. Gaji Pokok, Freelance, Dividen)")
    amount: float = Field(..., ge=0, description="Nominal amount in base currency")
    frequency: str = Field(default="monthly", description="'monthly' or 'annual'")
    notes: str | None = Field(default=None, description="Optional notes or details")


class IncomeUpdatePayload(BaseModel):
    monthly_net_income: float = Field(..., ge=0, description="Monthly Take-Home Pay (Net Income)")


def _call(fn, *args, **kwargs) -> Any:
    try:
        return fn(*args, **kwargs)
    except OpenNetWorthError as exc:
        raise HTTPException(to_http_status(exc), exc.message or str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/api/plan/track")
@router.get("/api/plan/track/")
@compute_only
def get_track_data(
    month: str | None = Query(
        default=None,
        description="Target month formatted as YYYY-MM (defaults to current month)",
    ),
):
    """Returns the full Conscious Spending Plan breakdown for the requested month."""
    return _call(csp_track.get_csp_tracking, month=month)


@router.post("/api/plan/track/config")
@router.post("/api/plan/track/config/")
def update_track_config(body: CspConfigUpdate):
    """Updates user customizations for Conscious Spending Plan category mapping and settings."""
    payload = body.model_dump(exclude_unset=True)
    return _call(csp_track.update_csp_config, payload)


@router.get("/api/plan/track/plan")
@router.get("/api/plan/track/plan/")
@compute_only
def get_csp_plan():
    """Returns the Conscious Spending Plan worksheet (planned expenses, ratios, and diagnosis)."""
    return _call(csp_track.get_csp_plan)


@router.get("/api/plan/track/planned-expenses")
@router.get("/api/plan/track/planned-expenses/")
@compute_only
def list_planned_expenses():
    """Returns the list of user-defined planned expenses."""
    return _call(csp_track.get_planned_expenses)


@router.post("/api/plan/track/planned-expenses")
@router.post("/api/plan/track/planned-expenses/")
@router.put("/api/plan/track/planned-expenses")
@router.put("/api/plan/track/planned-expenses/")
@router.patch("/api/plan/track/planned-expenses")
@router.patch("/api/plan/track/planned-expenses/")
def save_planned_expense(body: PlannedExpensePayload):
    """Adds or updates a planned expense (monthly or annual) in the CSP worksheet."""
    payload = body.model_dump(exclude_unset=True)
    return _call(csp_track.add_or_update_planned_expense, payload)


@router.get("/api/plan/track/planned-expenses/{expense_id}")
@router.get("/api/plan/track/planned-expenses/{expense_id}/")
@router.post("/api/plan/track/planned-expenses/{expense_id}")
@router.post("/api/plan/track/planned-expenses/{expense_id}/")
@router.put("/api/plan/track/planned-expenses/{expense_id}")
@router.put("/api/plan/track/planned-expenses/{expense_id}/")
@router.patch("/api/plan/track/planned-expenses/{expense_id}")
@router.patch("/api/plan/track/planned-expenses/{expense_id}/")
def update_planned_expense_by_id(expense_id: str, body: PlannedExpensePayload | None = None):
    """Updates a planned expense by ID."""
    payload = body.model_dump(exclude_unset=True) if body else {}
    payload["id"] = expense_id
    if not payload.get("name") and not payload.get("amount"):
        expenses = _call(csp_track.get_planned_expenses)
        item = next((e for e in expenses if e["id"] == expense_id), None)
        if not item:
            raise HTTPException(404, f"Planned expense '{expense_id}' not found.")
        return item
    return _call(csp_track.add_or_update_planned_expense, payload)


@router.delete("/api/plan/track/planned-expenses/{expense_id}")
@router.delete("/api/plan/track/planned-expenses/{expense_id}/")
def delete_planned_expense(expense_id: str):
    """Deletes a planned expense by ID."""
    deleted = _call(csp_track.delete_planned_expense, expense_id=expense_id)
    if not deleted:
        raise HTTPException(404, f"Planned expense '{expense_id}' not found.")
    return {"ok": True, "deleted_id": expense_id}


@router.delete("/api/plan/track/planned-expenses")
@router.delete("/api/plan/track/planned-expenses/")
def delete_planned_expense_fallback(
    expense_id: str | None = Query(default=None),
    id: str | None = Query(default=None),
    body: dict | None = None,
):
    """Fallback deletion via query parameter ?expense_id= or ?id= or JSON body."""
    target_id = expense_id or id or (body.get("id") or body.get("expense_id") if body else None)
    if not target_id:
        raise HTTPException(400, "Missing expense_id parameter.")
    deleted = _call(csp_track.delete_planned_expense, expense_id=target_id)
    if not deleted:
        raise HTTPException(404, f"Planned expense '{target_id}' not found.")
    return {"ok": True, "deleted_id": target_id}


@router.get("/api/plan/track/planned-incomes")
@router.get("/api/plan/track/planned-incomes/")
@compute_only
def list_planned_incomes():
    """Returns the list of user-defined planned income sources."""
    return _call(csp_track.get_planned_incomes)


@router.post("/api/plan/track/planned-incomes")
@router.post("/api/plan/track/planned-incomes/")
@router.put("/api/plan/track/planned-incomes")
@router.put("/api/plan/track/planned-incomes/")
@router.patch("/api/plan/track/planned-incomes")
@router.patch("/api/plan/track/planned-incomes/")
def save_planned_income(body: PlannedIncomePayload):
    """Adds or updates a planned income source."""
    payload = body.model_dump(exclude_unset=True)
    return _call(csp_track.add_or_update_planned_income, payload)


@router.get("/api/plan/track/planned-incomes/{income_id}")
@router.get("/api/plan/track/planned-incomes/{income_id}/")
@router.post("/api/plan/track/planned-incomes/{income_id}")
@router.post("/api/plan/track/planned-incomes/{income_id}/")
@router.put("/api/plan/track/planned-incomes/{income_id}")
@router.put("/api/plan/track/planned-incomes/{income_id}/")
@router.patch("/api/plan/track/planned-incomes/{income_id}")
@router.patch("/api/plan/track/planned-incomes/{income_id}/")
def update_planned_income_by_id(income_id: str, body: PlannedIncomePayload | None = None):
    """Updates a planned income source by ID."""
    payload = body.model_dump(exclude_unset=True) if body else {}
    payload["id"] = income_id
    if not payload.get("name") and not payload.get("amount"):
        incomes = _call(csp_track.get_planned_incomes)
        item = next((i for i in incomes if i["id"] == income_id), None)
        if not item:
            raise HTTPException(404, f"Planned income source '{income_id}' not found.")
        return item
    return _call(csp_track.add_or_update_planned_income, payload)


@router.delete("/api/plan/track/planned-incomes/{income_id}")
@router.delete("/api/plan/track/planned-incomes/{income_id}/")
def delete_planned_income(income_id: str):
    """Deletes a planned income source by ID."""
    deleted = _call(csp_track.delete_planned_income, income_id=income_id)
    if not deleted:
        raise HTTPException(404, f"Planned income source '{income_id}' not found.")
    return {"ok": True, "deleted_id": income_id}


@router.delete("/api/plan/track/planned-incomes")
@router.delete("/api/plan/track/planned-incomes/")
def delete_planned_income_fallback(
    income_id: str | None = Query(default=None),
    id: str | None = Query(default=None),
    body: dict | None = None,
):
    """Fallback deletion via query parameter ?income_id= or ?id= or JSON body."""
    target_id = income_id or id or (body.get("id") or body.get("income_id") if body else None)
    if not target_id:
        raise HTTPException(400, "Missing income_id parameter.")
    deleted = _call(csp_track.delete_planned_income, income_id=target_id)
    if not deleted:
        raise HTTPException(404, f"Planned income source '{target_id}' not found.")
    return {"ok": True, "deleted_id": target_id}


@router.get("/api/plan/track/income")
@router.get("/api/plan/track/income/")
def get_csp_income():
    """Returns the custom take-home pay override if set."""
    cfg = _call(csp_track.get_csp_config)
    return {"custom_monthly_income": cfg.get("custom_monthly_income")}


@router.post("/api/plan/track/income")
@router.post("/api/plan/track/income/")
@router.put("/api/plan/track/income")
@router.put("/api/plan/track/income/")
@router.patch("/api/plan/track/income")
@router.patch("/api/plan/track/income/")
def set_csp_income(body: IncomeUpdatePayload):
    """Updates take-home pay (net income) for the Conscious Spending Plan."""
    return _call(
        csp_track.update_csp_config,
        {"custom_monthly_income": body.monthly_net_income},
    )
