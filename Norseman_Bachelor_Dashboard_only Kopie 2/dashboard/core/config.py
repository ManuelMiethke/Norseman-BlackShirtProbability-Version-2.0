from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class AppInfo:
    title: str
    subtitle: str
    source_url: str
    contact_email: str
    data_context: str


@dataclass(frozen=True)
class AssetPaths:
    dashboard_dir: Path
    assets_dir: Path
    logos_dir: Path
    main_long_csv: Path
    wide_csv: Path
    model_csv: Path
    course_profile_csv: Path
    black_shirt_logo: Path
    hdm_logo: Path
    styles_css: Path

    def runtime_assets(self) -> tuple[Path, ...]:
        return (
            self.main_long_csv,
            self.wide_csv,
            self.model_csv,
            self.course_profile_csv,
        )


@dataclass(frozen=True)
class RaceYearConfig:
    race_id: str
    race_name: str
    location: str
    year: int
    distance_label: str
    cutoff_run_km: float
    cutoff_split_key: str
    finish_distance_km: float
    starters_after_swim: int | None
    result_source: str
    import_status: str
    notes: tuple[str, ...]


DASHBOARD_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = DASHBOARD_DIR / "assets"
LOGOS_DIR = ASSETS_DIR / "logos"

ASSET_PATHS = AssetPaths(
    dashboard_dir=DASHBOARD_DIR,
    assets_dir=ASSETS_DIR,
    logos_dir=LOGOS_DIR,
    main_long_csv=ASSETS_DIR / "nxtri_data_all_years_long_ready_featured.csv",
    wide_csv=ASSETS_DIR / "nxtri_data_all_years.csv",
    model_csv=ASSETS_DIR / "xgb_black_probs_long_with_errors.csv",
    course_profile_csv=ASSETS_DIR / "course_profile.csv",
    black_shirt_logo=LOGOS_DIR / "black-shirt_icon.jpg",
    hdm_logo=LOGOS_DIR / "HdM_logo.png",
    styles_css=ASSETS_DIR / "styles.css",
)

APP_INFO = AppInfo(
    title="Norseman Performance Dashboard",
    subtitle="Triathlon race intelligence for pacing, cut-off pressure, weather impact and year-over-year outcomes.",
    source_url="https://www.nxtri.com/",
    contact_email="mm326@hdm-stuttgart.de",
    data_context="Packaged dashboard assets derived from the Norseman thesis project.",
)

GROUP_OPTIONS = ("All", "Top 10", "Black Shirt", "White Shirt", "DNF")
DEFAULT_GROUP = GROUP_OPTIONS[0]
DEFAULT_PAGE_TITLE = "Norseman Dashboard"

RACE_YEAR_REGISTRY: dict[int, RaceYearConfig] = {
    2018: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2018,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=32.5,
        cutoff_split_key="run_32_5km_langefonn",
        finish_distance_km=216.3,
        starters_after_swim=242,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("32.5 km Black/White decision year",),
    ),
    2019: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2019,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=32.5,
        cutoff_split_key="run_32_5km_langefonn",
        finish_distance_km=216.3,
        starters_after_swim=261,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("32.5 km Black/White decision year",),
    ),
    2021: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2021,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=32.5,
        cutoff_split_key="run_32_5km_langefonn",
        finish_distance_km=216.3,
        starters_after_swim=97,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("32.5 km Black/White decision year",),
    ),
    2022: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2022,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=32.5,
        cutoff_split_key="run_32_5km_langefonn",
        finish_distance_km=216.3,
        starters_after_swim=233,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("32.5 km Black/White decision year", "Course finish differs from 221.3 km years."),
    ),
    2024: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2024,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=37.5,
        cutoff_split_key="run_37_5km_stavsro_cut_off",
        finish_distance_km=221.3,
        starters_after_swim=255,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("37.5 km Black/White decision year",),
    ),
    2025: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year=2025,
        distance_label="Xtreme Full Distance",
        cutoff_run_km=37.5,
        cutoff_split_key="run_37_5km_stavsro_cut_off",
        finish_distance_km=221.3,
        starters_after_swim=253,
        result_source="Packaged dashboard assets",
        import_status="available",
        notes=("37.5 km Black/White decision year",),
    ),
}

KNOWN_RACE_YEARS = tuple(sorted(RACE_YEAR_REGISTRY.keys(), reverse=True))


def default_year_options() -> list[int | str]:
    return ["All", *KNOWN_RACE_YEARS]


def assets_last_updated_label() -> str:
    mtimes = [path.stat().st_mtime for path in ASSET_PATHS.runtime_assets() if path.exists()]
    if not mtimes:
        return "n/a"
    return datetime.fromtimestamp(max(mtimes)).strftime("%Y-%m-%d")
