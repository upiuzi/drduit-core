"""
Tests for Conscious Spending Plan (CSP) tracking: service calculations, classification,
category overrides, unexpected cost buffer, and API endpoint smoke tests.
"""

from __future__ import annotations

import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.plan_track import router as plan_track_router
from backend.db.engine import get_engine
from backend.db.tables import metadata
from backend.services import csp_track


class TestCspTrack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        metadata.create_all(bind=get_engine())

    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(plan_track_router)
        self.client = TestClient(self.app)
        csp_track._get_settings_store().save({
            "planned_expenses": [],
            "category_mappings": {},
            "unexpected_buffer_enabled": True,
            "custom_monthly_income": None,
        })

    def test_classify_category_defaults(self):
        # Fixed costs
        self.assertEqual(csp_track.classify_category("c1", "Rent & Utilities", {}), "fixed_costs")
        self.assertEqual(csp_track.classify_category("c2", "Belanja Dapur / Groceries", {}), "fixed_costs")
        self.assertEqual(csp_track.classify_category("c3", "Cicilan KPR", {}), "fixed_costs")
        self.assertEqual(csp_track.classify_category("c4", "BPJS / Asuransi", {}), "fixed_costs")

        # Investments
        self.assertEqual(csp_track.classify_category("c5", "Investasi Saham", {}), "investments")
        self.assertEqual(csp_track.classify_category("c6", "Reksadana Bibit", {}), "investments")
        self.assertEqual(csp_track.classify_category("c7", "Crypto Portfolio", {}), "investments")

        # Savings
        self.assertEqual(csp_track.classify_category("c8", "Dana Darurat", {}), "savings")
        self.assertEqual(csp_track.classify_category("c9", "Tabungan Liburan", {}), "savings")

        # Guilt-free spending
        self.assertEqual(csp_track.classify_category("c10", "Ngopi & Dining Out", {}), "guilt_free")
        self.assertEqual(csp_track.classify_category("c11", "Streaming Subscriptions", {}), "guilt_free")
        self.assertEqual(csp_track.classify_category("c12", "Hobi Main Game", {}), "guilt_free")
        self.assertEqual(csp_track.classify_category(None, "Random Expense", {}), "guilt_free")

    def test_classify_category_overrides(self):
        overrides = {
            "c_custom": "fixed_costs",
            "c_stream": "fixed_costs",  # user treats streaming as fixed cost
        }
        self.assertEqual(csp_track.classify_category("c_custom", "Random Item", overrides), "fixed_costs")
        self.assertEqual(csp_track.classify_category("c_stream", "Netflix", overrides), "fixed_costs")

    def test_get_csp_tracking_empty_book(self):
        data = csp_track.get_csp_tracking("2026-11")
        self.assertEqual(data["month"], "2026-11")
        self.assertIn("buckets", data)
        self.assertIn("fixed_costs", data["buckets"])
        self.assertIn("investments", data["buckets"])
        self.assertIn("savings", data["buckets"])
        self.assertIn("guilt_free", data["buckets"])
        self.assertEqual(data["total_spent"], 0.0)
        self.assertTrue(data["unexpected_buffer_enabled"])
        self.assertGreaterEqual(data["guilt_free_remaining"], 0.0)

    def test_update_csp_config(self):
        update = {
            "category_mappings": {"cat_123": "savings"},
            "unexpected_buffer_enabled": False,
            "custom_monthly_income": 15000000.0,
        }
        saved = csp_track.update_csp_config(update)
        self.assertEqual(saved["category_mappings"]["cat_123"], "savings")
        self.assertFalse(saved["unexpected_buffer_enabled"])
        self.assertEqual(saved["custom_monthly_income"], 15000000.0)

        # Read back through tracking
        data = csp_track.get_csp_tracking("2026-11")
        self.assertEqual(data["net_income"], 15000000.0)
        self.assertFalse(data["unexpected_buffer_enabled"])
        self.assertEqual(data["category_mappings"]["cat_123"], "savings")

    def test_api_plan_track_endpoints(self):
        res = self.client.get("/api/plan/track?month=2026-11")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["month"], "2026-11")
        self.assertIn("guilt_free_remaining", body)
        self.assertIn("buckets", body)

        # Post config update
        post_res = self.client.post(
            "/api/plan/track/config",
            json={"unexpected_buffer_enabled": True},
        )
        self.assertEqual(post_res.status_code, 200)
        self.assertTrue(post_res.json()["unexpected_buffer_enabled"])

    def test_planned_expenses_crud_and_prorating(self):
        # 1. Add annual rent of 28,000,000
        rent = csp_track.add_or_update_planned_expense({
            "name": "Kontrakan Rumah",
            "amount": 28000000,
            "frequency": "annual",
            "bucket": "fixed_costs",
            "due_date": "2027-01-25",
        })
        self.assertEqual(rent["name"], "Kontrakan Rumah")
        self.assertEqual(rent["amount"], 28000000.0)
        self.assertEqual(rent["frequency"], "annual")
        self.assertEqual(rent["monthly_amount"], 2333333.33)
        self.assertEqual(rent["annual_amount"], 28000000.0)
        self.assertEqual(rent["bucket"], "fixed_costs")

        # 2. Add monthly electricity
        pln = csp_track.add_or_update_planned_expense({
            "name": "Listrik PLN",
            "amount": 500000,
            "frequency": "monthly",
            "bucket": "fixed_costs",
        })
        self.assertEqual(pln["monthly_amount"], 500000.0)
        self.assertEqual(pln["annual_amount"], 6000000.0)

        # 3. List planned expenses
        items = csp_track.get_planned_expenses()
        names = [it["name"] for it in items]
        self.assertIn("Kontrakan Rumah", names)
        self.assertIn("Listrik PLN", names)

        # 4. Set income to 4,000,000 to trigger Fixed Costs > 60%
        csp_track.update_csp_config({
            "custom_monthly_income": 4000000,
            "unexpected_buffer_enabled": True,
        })
        plan = csp_track.get_csp_plan()
        self.assertEqual(plan["net_income"], 4000000.0)
        fc = plan["buckets"]["fixed_costs"]
        # Subtotal: 2,333,333.33 + 500,000 = 2,833,333.33
        # Buffer (15%): 425,000.00
        # Total: 3,258,333.33 -> 81.5% of income
        self.assertAlmostEqual(fc["monthly_subtotal"], 2833333.33, places=1)
        self.assertGreater(fc["pct_of_income"], 60.0)
        self.assertEqual(fc["status"], "danger")

        # Diagnosis should flag danger and prescribe cut or income increase
        danger_diags = [d for d in plan["diagnoses"] if d["bucket"] == "fixed_costs" and d["severity"] == "danger"]
        self.assertEqual(len(danger_diags), 1)
        self.assertIn("cut fixed costs", danger_diags[0]["action"].lower())

        # 5. Delete expense
        deleted = csp_track.delete_planned_expense(expense_id=rent["id"])
        self.assertTrue(deleted)
        remaining_names = [it["name"] for it in csp_track.get_planned_expenses()]
        self.assertNotIn("Kontrakan Rumah", remaining_names)

    def test_api_planned_expenses_routes(self):
        # 1. POST planned expense (no trailing slash)
        post_res = self.client.post(
            "/api/plan/track/planned-expenses",
            json={
                "name": "Gym Membership",
                "amount": 400000,
                "frequency": "monthly",
                "bucket": "fixed_costs",
            },
        )
        self.assertEqual(post_res.status_code, 200)
        saved = post_res.json()
        self.assertEqual(saved["name"], "Gym Membership")
        self.assertEqual(saved["monthly_amount"], 400000.0)
        expense_id = saved["id"]

        # 2. GET planned expenses (both / and non-/)
        get_res1 = self.client.get("/api/plan/track/planned-expenses")
        self.assertEqual(get_res1.status_code, 200)
        self.assertEqual(len(get_res1.json()), 1)
        self.assertEqual(get_res1.json()[0]["name"], "Gym Membership")

        get_res2 = self.client.get("/api/plan/track/planned-expenses/")
        self.assertEqual(get_res2.status_code, 200)
        self.assertEqual(len(get_res2.json()), 1)

        # 3. PUT update planned expense
        put_res = self.client.put(
            f"/api/plan/track/planned-expenses/{expense_id}",
            json={
                "name": "Gym & Pool Membership",
                "amount": 550000,
                "frequency": "monthly",
                "bucket": "fixed_costs",
            },
        )
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["name"], "Gym & Pool Membership")
        self.assertEqual(put_res.json()["monthly_amount"], 550000.0)

        # 4. PUT without path param (using payload.id)
        put_res2 = self.client.put(
            "/api/plan/track/planned-expenses",
            json={
                "id": expense_id,
                "name": "Gym, Pool & Sauna",
                "amount": 600000,
                "frequency": "monthly",
                "bucket": "fixed_costs",
            },
        )
        self.assertEqual(put_res2.status_code, 200)
        self.assertEqual(put_res2.json()["name"], "Gym, Pool & Sauna")

        # 5. POST income
        inc_res = self.client.post(
            "/api/plan/track/income",
            json={"monthly_net_income": 10000000},
        )
        self.assertEqual(inc_res.status_code, 200)

        # 6. GET plan
        plan_res = self.client.get("/api/plan/track/plan")
        self.assertEqual(plan_res.status_code, 200)
        plan_data = plan_res.json()
        self.assertEqual(plan_data["net_income"], 10000000.0)
        self.assertIn("buckets", plan_data)
        self.assertIn("diagnoses", plan_data)
        self.assertIn("score", plan_data)
        self.assertIn("points", plan_data["score"])
        self.assertIn("grade", plan_data["score"])

        # 7. DELETE planned expense via query param fallback
        del_fallback = self.client.delete(f"/api/plan/track/planned-expenses?expense_id={expense_id}")
        self.assertEqual(del_fallback.status_code, 200)
        self.assertTrue(del_fallback.json()["ok"])

        # 8. Verify list is empty
        empty_res = self.client.get("/api/plan/track/planned-expenses")
        self.assertEqual(empty_res.status_code, 200)
        self.assertEqual(len(empty_res.json()), 0)

    def test_parse_amount_and_normalize_frequency(self):
        self.assertEqual(csp_track.parse_amount(28000000), 28000000.0)
        self.assertEqual(csp_track.parse_amount("28000000"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("28jt"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("28 jt"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("28 juta"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("2.5jt"), 2500000.0)
        self.assertEqual(csp_track.parse_amount("28.000.000"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("28,000,000"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("Rp 28.000.000"), 28000000.0)
        self.assertEqual(csp_track.parse_amount("500k"), 500000.0)
        self.assertEqual(csp_track.parse_amount("500rb"), 500000.0)

        self.assertEqual(csp_track.normalize_frequency("annual"), "annual")
        self.assertEqual(csp_track.normalize_frequency("tahunan"), "annual")
        self.assertEqual(csp_track.normalize_frequency("per tahun"), "annual")
        self.assertEqual(csp_track.normalize_frequency("yearly"), "annual")
        self.assertEqual(csp_track.normalize_frequency("monthly"), "monthly")
        self.assertEqual(csp_track.normalize_frequency("bulanan"), "monthly")
        self.assertEqual(csp_track.normalize_frequency("per bulan"), "monthly")

    def test_ai_tools_planned_expense(self):
        import asyncio
        import json
        from backend.ai.tools.csp_plan import (
            add_csp_planned_expense_tool,
            get_csp_plan_tool,
            set_csp_income_tool,
        )

        async def _run():
            # Set income using "15jt"
            await set_csp_income_tool({"monthly_net_income": "15jt"})

            # Add annual expense "28jt" "per tahun"
            res_text, _ = await add_csp_planned_expense_tool({
                "name": "Kontrakan Rumah",
                "amount": "28jt",
                "frequency": "per tahun",
                "due_date": "2027-01-25",
            })
            res = json.loads(res_text)
            saved = res["saved_expense"]
            self.assertEqual(saved["name"], "Kontrakan Rumah")
            self.assertEqual(saved["amount"], 28000000.0)
            self.assertEqual(saved["frequency"], "annual")
            self.assertEqual(saved["monthly_amount"], 2333333.33)
            self.assertEqual(saved["due_date"], "2027-01-25")
            self.assertIn("score", res["updated_plan_summary"])

            # Verify that get_csp_tracking for 2027-01 has this planned expense and due amount
            track_2027 = csp_track.get_csp_tracking("2027-01")
            fc = track_2027["buckets"]["fixed_costs"]
            # 2,333,333.33 + 15% unexpected buffer (350,000) = 2,683,333.33
            self.assertEqual(fc["planned_monthly"], 2683333.33)
            self.assertEqual(fc["planned_due_amount"], 28000000.0)
            self.assertEqual(len(fc["planned_due_in_month"]), 1)
            self.assertEqual(fc["planned_due_in_month"][0]["name"], "Kontrakan Rumah")

        asyncio.run(_run())

    def test_normalize_bucket_variations(self):
        self.assertEqual(csp_track.normalize_bucket("Fixed Costs"), "fixed_costs")
        self.assertEqual(csp_track.normalize_bucket("fixed costs"), "fixed_costs")
        self.assertEqual(csp_track.normalize_bucket("fixed_cost"), "fixed_costs")
        self.assertEqual(csp_track.normalize_bucket("needs"), "fixed_costs")
        self.assertEqual(csp_track.normalize_bucket("kebutuhan"), "fixed_costs")
        self.assertEqual(csp_track.normalize_bucket("Investments"), "investments")
        self.assertEqual(csp_track.normalize_bucket("investasi"), "investments")
        self.assertEqual(csp_track.normalize_bucket("Savings Goals"), "savings")
        self.assertEqual(csp_track.normalize_bucket("tabungan"), "savings")
        self.assertEqual(csp_track.normalize_bucket("Guilt Free"), "guilt_free")
        self.assertEqual(csp_track.normalize_bucket("jajan"), "guilt_free")


if __name__ == "__main__":
    unittest.main()
