from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = REPO_ROOT / "Norseman_Bachelor_Dashboard_only Kopie 2" / "dashboard"
sys.path.insert(0, str(DASHBOARD_DIR))

from core.config import ASSET_PATHS, KNOWN_RACE_YEARS, RACE_YEAR_REGISTRY
from core.validators import validate_asset_paths, validate_race_year_registry


class DashboardConfigTests(unittest.TestCase):
    def test_asset_paths_exist(self) -> None:
        validate_asset_paths()
        self.assertTrue(ASSET_PATHS.styles_css.exists())

    def test_race_year_registry_is_consistent(self) -> None:
        validate_race_year_registry()
        self.assertEqual(list(KNOWN_RACE_YEARS), sorted(RACE_YEAR_REGISTRY.keys(), reverse=True))

    def test_registry_entries_match_their_keys(self) -> None:
        for year, config in RACE_YEAR_REGISTRY.items():
            self.assertEqual(year, config.year)
            self.assertGreater(config.cutoff_run_km, 0)
            self.assertGreater(config.finish_distance_km, 0)


if __name__ == "__main__":
    unittest.main()
