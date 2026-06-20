from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from core.config import ASSET_PATHS


LONG_REQUIRED_COLUMNS = (
    "year",
    "bib",
    "name",
    "finish_type",
    "split_key",
    "race_distance_km",
    "split_rank",
)
WIDE_REQUIRED_COLUMNS = (
    "year",
    "bib",
    "name",
    "finish_type",
    "overall_rank",
    "swim_time",
    "bike_time",
    "run_time",
)
MODEL_REQUIRED_COLUMNS = (
    "year",
    "bib",
    "name",
    "finish_type",
    "split_key",
    "race_distance_km",
    "p_black",
)
COURSE_REQUIRED_COLUMNS = (
    "distance_km",
    "elev_norseman_m",
    "elev_hawaii_m",
)

NUMERIC_HINTS = (
    "year",
    "bib",
    "overall_rank",
    "split_rank",
    "split_rank_relative",
    "race_distance_km",
    "split_distance_km",
    "segment_distance_km",
    "segment_time_s",
    "segment_speed_kmh",
    "cum_time_seconds",
    "progress_perc",
    "p_black",
    "y_true",
    "y_pred",
)


def _assert_exists(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"{label} not found at: {path}")


def _validate_columns(df: pd.DataFrame, required_columns: tuple[str, ...], label: str) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"{label} is missing required columns: {missing}")


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    for column in NUMERIC_HINTS:
        if column in normalized.columns:
            try:
                normalized[column] = pd.to_numeric(normalized[column])
            except (TypeError, ValueError):
                pass
    return normalized


@st.cache_data(show_spinner=False)
def _read_csv(path: Path, label: str, required_columns: tuple[str, ...]) -> pd.DataFrame:
    _assert_exists(path, label)
    df = pd.read_csv(path, low_memory=False)
    _validate_columns(df, required_columns, label)
    return _normalize_frame(df)


@st.cache_data(show_spinner=False)
def df_long(path: Path | None = None) -> pd.DataFrame:
    source = Path(path) if path is not None else ASSET_PATHS.main_long_csv
    return _read_csv(source, "Main long CSV", LONG_REQUIRED_COLUMNS)


@st.cache_data(show_spinner=False)
def df_wide(path: Path | None = None) -> pd.DataFrame:
    source = Path(path) if path is not None else ASSET_PATHS.wide_csv
    return _read_csv(source, "Wide CSV", WIDE_REQUIRED_COLUMNS)


@st.cache_data(show_spinner=False)
def df_model(path: Path | None = None) -> pd.DataFrame:
    source = Path(path) if path is not None else ASSET_PATHS.model_csv
    return _read_csv(source, "Model CSV", MODEL_REQUIRED_COLUMNS)


@st.cache_data(show_spinner=False)
def course_profile(path: Path | None = None) -> pd.DataFrame:
    source = Path(path) if path is not None else ASSET_PATHS.course_profile_csv
    df = _read_csv(source, "Course profile CSV", COURSE_REQUIRED_COLUMNS)
    if "distance_km" in df.columns:
        df = df.sort_values("distance_km").reset_index(drop=True)
    return df


def available_year_options(df: pd.DataFrame | None = None) -> list[int | str]:
    data = df if df is not None else df_long()
    if "year" not in data.columns:
        return ["All"]
    years = pd.to_numeric(data["year"], errors="coerce").dropna().astype(int).unique().tolist()
    return ["All", *sorted(years, reverse=True)]
