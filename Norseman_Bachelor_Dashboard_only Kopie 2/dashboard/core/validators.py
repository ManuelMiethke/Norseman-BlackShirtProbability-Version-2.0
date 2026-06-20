from __future__ import annotations

from typing import Any

import pandas as pd

from core.config import ASSET_PATHS, KNOWN_RACE_YEARS, RACE_YEAR_REGISTRY
from core.data import course_profile, df_long, df_model, df_wide


def _extract_years(df: pd.DataFrame) -> list[int]:
    if "year" not in df.columns:
        return []
    years = pd.to_numeric(df["year"], errors="coerce").dropna().astype(int).unique().tolist()
    return sorted(years)


def validate_asset_paths() -> None:
    missing = [str(path) for path in ASSET_PATHS.runtime_assets() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing dashboard runtime assets: {missing}")


def validate_race_year_registry() -> None:
    registry_years = tuple(sorted(RACE_YEAR_REGISTRY.keys(), reverse=True))
    if registry_years != KNOWN_RACE_YEARS:
        raise ValueError(
            "KNOWN_RACE_YEARS does not match RACE_YEAR_REGISTRY keys: "
            f"{KNOWN_RACE_YEARS} vs {registry_years}"
        )

    for year, config in RACE_YEAR_REGISTRY.items():
        if config.year != year:
            raise ValueError(f"Registry key/year mismatch for {year}: {config.year}")
        if config.cutoff_run_km <= 0:
            raise ValueError(f"Invalid cutoff_run_km for {year}: {config.cutoff_run_km}")
        if config.finish_distance_km <= 0:
            raise ValueError(f"Invalid finish_distance_km for {year}: {config.finish_distance_km}")
        if not config.cutoff_split_key:
            raise ValueError(f"Missing cutoff_split_key for {year}")
        if config.starters_after_swim is not None and config.starters_after_swim <= 0:
            raise ValueError(f"Invalid starters_after_swim for {year}: {config.starters_after_swim}")


def validate_dashboard_assets() -> dict[str, Any]:
    validate_asset_paths()
    validate_race_year_registry()

    long_df = df_long()
    wide_df = df_wide()
    model_df = df_model()
    course_df = course_profile()

    long_years = _extract_years(long_df)
    wide_years = _extract_years(wide_df)
    model_years = _extract_years(model_df)

    if long_years != wide_years:
        raise ValueError(f"Long/Wide year mismatch: {long_years} vs {wide_years}")
    if long_years != model_years:
        raise ValueError(f"Long/Model year mismatch: {long_years} vs {model_years}")

    registry_missing = sorted(set(long_years) - set(RACE_YEAR_REGISTRY))
    if registry_missing:
        raise ValueError(f"Years exist in data but not in registry: {registry_missing}")

    if course_df["distance_km"].is_monotonic_increasing is False:
        raise ValueError("Course profile distance_km must be monotonically increasing.")

    return {
        "years": long_years,
        "registry_years": list(KNOWN_RACE_YEARS),
        "long": {"rows": int(len(long_df)), "columns": int(len(long_df.columns))},
        "wide": {"rows": int(len(wide_df)), "columns": int(len(wide_df.columns))},
        "model": {"rows": int(len(model_df)), "columns": int(len(model_df.columns))},
        "course": {"rows": int(len(course_df)), "columns": int(len(course_df.columns))},
    }
