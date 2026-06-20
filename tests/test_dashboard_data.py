from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = REPO_ROOT / "Norseman_Bachelor_Dashboard_only Kopie 2" / "dashboard"
sys.path.insert(0, str(DASHBOARD_DIR))

from core.data import available_year_options, course_profile, df_long, df_model, df_wide
from core.validators import validate_dashboard_assets


class DashboardDataTests(unittest.TestCase):
    def test_dashboard_assets_validate(self) -> None:
        summary = validate_dashboard_assets()
        self.assertGreater(summary["long"]["rows"], 0)
        self.assertGreater(summary["wide"]["rows"], 0)
        self.assertGreater(summary["model"]["rows"], 0)
        self.assertGreater(summary["course"]["rows"], 0)

    def test_year_options_are_data_driven(self) -> None:
        options = available_year_options(df_long())
        self.assertEqual(options[0], "All")
        self.assertIn(2025, options)
        self.assertIn(2018, options)

    def test_course_profile_is_sorted(self) -> None:
        profile = course_profile()
        self.assertTrue(profile["distance_km"].is_monotonic_increasing)

    def test_long_wide_model_years_match(self) -> None:
        long_years = sorted(df_long()["year"].dropna().astype(int).unique().tolist())
        wide_years = sorted(df_wide()["year"].dropna().astype(int).unique().tolist())
        model_years = sorted(df_model()["year"].dropna().astype(int).unique().tolist())
        self.assertEqual(long_years, wide_years)
        self.assertEqual(long_years, model_years)


if __name__ == "__main__":
    unittest.main()
