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


if __name__ == "__main__":
    unittest.main()
