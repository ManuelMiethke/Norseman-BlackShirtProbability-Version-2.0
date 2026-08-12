"""
Anreicherung des Long-Datensatzes: Wetter, Hoehenprofil, Windeffekt.

Ersetzt wetter_daten/open-meteo.py + wetter_und_long_splits_mergen/mergen.py +
new_data/elevation_in_Long.py + new_data/wind_effect.py durch einen Lauf.
"""
from __future__ import annotations

from datetime import datetime
from math import atan2, cos, radians, sin, sqrt

import numpy as np
import pandas as pd
import requests

import config as C

TIMEOUT = 60


# ---------------------------------------------------------------------------
# Wetter
# ---------------------------------------------------------------------------

def weathercode_to_emoji(code) -> str:
    if code is None or (isinstance(code, float) and np.isnan(code)):
        return ""
    code = int(code)
    table = {
        0: "☀️", 45: "🌫️", 48: "🌫️", 95: "⛈️", 96: "⛈️🧊", 99: "⛈️🧊",
    }
    if code in table:
        return table[code]
    if code in (1, 2, 3):
        return "⛅"
    if code in (51, 53, 55, 56, 57):
        return "🌦️"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "🌧️"
    if code in (71, 73, 75, 77):
        return "❄️"
    if code in (85, 86):
        return "🌨️"
    return "🌡️"


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def load_stations() -> pd.DataFrame:
    df = pd.read_csv(C.WEATHER_STATIONS_CSV)
    df = df[["station_name", "lat", "lon"]].dropna().drop_duplicates()
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
    return df.dropna()


def fetch_weather(lat: float, lon: float, date: str, use_archive: bool = True) -> pd.DataFrame:
    """Stundenwerte fuer einen Tag. Faellt automatisch auf die Forecast-API
    zurueck, solange das ERA5-Archiv den Renntag noch nicht enthaelt."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(C.HOURLY_VARS),
        "start_date": date,
        "end_date": date,
        "timezone": C.TIMEZONE,
    }
    urls = [C.OPENMETEO_API, C.OPENMETEO_FORECAST_API] if use_archive else [C.OPENMETEO_FORECAST_API]

    last_error: Exception | None = None
    for url in urls:
        try:
            resp = requests.get(url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            hourly = data.get("hourly") or {}
            if not hourly.get("time"):
                raise ValueError("keine Stundenwerte enthalten")
            frame = pd.DataFrame(hourly)
            if frame[[c for c in C.HOURLY_VARS if c in frame]].isna().all().all():
                raise ValueError("nur Nullwerte geliefert")
            frame["time_nmt"] = pd.to_datetime(frame["time"])
            frame = frame.drop(columns=["time"])
            return frame
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise RuntimeError(f"Open-Meteo lieferte keine Daten fuer {lat},{lon} am {date}: {last_error}")


def build_weather_table(year: int, date: str, reuse: bool = True) -> pd.DataFrame:
    """Stundenwerte fuer alle Stationen. Ein bereits geladener Stand wird
    wiederverwendet - Wetterdaten aendern sich nach dem Renntag nicht mehr,
    und Wiederholungslaeufe muessen Open-Meteo nicht erneut belasten."""
    cached = C.BUILD_DIR / f"{year}_openmeteo_by_station.csv"
    if reuse and cached.exists():
        weather = pd.read_csv(cached)
        weather["time_nmt"] = pd.to_datetime(weather["time_nmt"])
        print(f"[enrich] Wetter aus vorhandenem Abruf: {cached.name} "
              f"({weather['station_name'].nunique()} Stationen)")
        return weather

    stations = load_stations()
    frames = []
    for _, s in stations.iterrows():
        print(f"[enrich] Wetter {s['station_name']} ({s['lat']:.4f}, {s['lon']:.4f})")
        frame = fetch_weather(float(s["lat"]), float(s["lon"]), date)
        frame.insert(0, "year", year)
        frame.insert(1, "station_name", s["station_name"])
        frame.insert(2, "lat", float(s["lat"]))
        frame.insert(3, "lon", float(s["lon"]))
        frames.append(frame)

    weather = pd.concat(frames, ignore_index=True)
    weather["weather_emoji"] = weather["weathercode"].map(weathercode_to_emoji)
    weather["date"] = weather["time_nmt"].dt.strftime("%d.%m.%y")
    weather["time"] = weather["time_nmt"].dt.strftime("%H:%M")
    weather["lat2"] = weather["lat"]
    weather["lon2"] = weather["lon"]
    return weather


def station_for_split_map(stations: pd.DataFrame) -> dict[str, str]:
    """Jeder Station der Strecke die naechstgelegene Wetterstation zuordnen."""
    points = pd.read_csv(C.SPLIT_POINTS_CSV)
    points["split_key"] = points["split_name"].astype(str).str.replace("_time", "", regex=False)

    mapping: dict[str, str] = {}
    coords = stations[["lat", "lon"]].to_numpy()
    names = stations["station_name"].tolist()

    for _, row in points.iterrows():
        lat, lon = row.get("lat"), row.get("lon")
        if pd.isna(lat) or pd.isna(lon):
            continue
        dists = [_haversine(float(lat), float(lon), la, lo) for la, lo in coords]
        mapping[row["split_key"]] = names[int(np.argmin(dists))]

    mapping.update(C.MANUAL_STATION_MAP)
    return mapping


def attach_weather(long: pd.DataFrame, weather: pd.DataFrame, stations: pd.DataFrame) -> pd.DataFrame:
    mapping = station_for_split_map(stations)
    long = long.copy()
    long["station_for_split"] = long["split_key"].map(mapping)

    missing = sorted(set(long.loc[long["station_for_split"].isna(), "split_key"]))
    if missing:
        print(f"[enrich] WARNUNG: keine Wetterstation zugeordnet fuer {missing}")

    race_start = pd.to_timedelta(C.RACE_START_TIME).total_seconds()
    clock_hours = np.round((race_start + long["split_time_s"]) / 3600.0)
    long["weather_time"] = [
        f"{int(h) % 24:02d}:00" if pd.notna(h) else None for h in clock_hours
    ]
    # Schwimmstart immer 05:00 (Wassertemperatur zum Startzeitpunkt)
    long.loc[long["station_for_split"] == "Eidfjord Swim", "weather_time"] = "05:00"

    wx_cols = [
        "year", "station_name", "lat", "lon", "date", "time",
        *C.HOURLY_VARS, "time_nmt", "weather_emoji", "lat2", "lon2",
    ]
    wx = weather[[c for c in wx_cols if c in weather.columns]]

    merged = long.merge(
        wx,
        how="left",
        left_on=["year", "station_for_split", "weather_time"],
        right_on=["year", "station_name", "time"],
    )
    return merged


# ---------------------------------------------------------------------------
# Hoehenprofil
# ---------------------------------------------------------------------------

def attach_elevation(long: pd.DataFrame) -> pd.DataFrame:
    if not C.SPLIT_ELEVATION_CSV.exists():
        print("[enrich] WARNUNG: split_elevation_grade.csv fehlt - Hoehenfeatures bleiben leer")
        for col in ["elev_gain_m", "elev_loss_m", "net_elev_m", "avg_grade_pct"]:
            long[col] = np.nan
        return long

    seg = pd.read_csv(C.SPLIT_ELEVATION_CSV)
    seg["split_key"] = seg["to_split"].astype(str).str.replace(r"_time$", "", regex=True).str.strip()
    seg = seg[["split_key", "elev_gain_m", "elev_loss_m", "net_elev_m", "avg_grade_pct"]]

    merged = long.merge(seg, how="left", on="split_key")

    # Kein Hoehenmeter ohne Bewegung (Transitions, Schwimm-Ziel)
    zero = merged["segment_distance_km"].fillna(0).eq(0) | merged["leg"].eq("swim")
    for col in ["elev_gain_m", "elev_loss_m", "net_elev_m", "avg_grade_pct"]:
        merged.loc[zero, col] = 0.0
    return merged


# ---------------------------------------------------------------------------
# Windeffekt
# ---------------------------------------------------------------------------

def movement_direction(split_key: str) -> float:
    if not isinstance(split_key, str):
        return np.nan
    if split_key in C.BIKE_WEST_KEYS:
        return 270.0
    if split_key in C.BIKE_SOUTH_KEYS:
        return 180.0
    if split_key.startswith("run") or split_key.startswith("finish"):
        return 180.0
    return np.nan


def classify_wind(row) -> object:
    move, wind = row.get("movement_direction_deg"), row.get("wind_direction_10m")
    if pd.isna(move) or pd.isna(wind):
        return pd.NA
    rel = (float(wind) - float(move) + 360) % 360
    if rel <= 45 or rel >= 315:
        return "headwind"
    if 135 <= rel <= 225:
        return "tailwind"
    return "crosswind"


def attach_wind(long: pd.DataFrame) -> pd.DataFrame:
    long = long.copy()
    long["movement_direction_deg"] = long["split_key"].map(movement_direction)
    long["wind_effect"] = long.apply(classify_wind, axis=1)

    # Finish erbt Richtung/Windeffekt vom letzten Messpunkt davor
    def _fill_finish(group: pd.DataFrame) -> pd.DataFrame:
        ref = group[group["split_key"] == "run_40km_right_before_mt_gaustatoppen"]
        if ref.empty:
            return group
        finish = group["split_key"].isin(["finish_black_t_shirt", "finish_white_t_shirt"])
        group.loc[finish & group["movement_direction_deg"].isna(), "movement_direction_deg"] = \
            ref["movement_direction_deg"].iloc[0]
        group.loc[finish & group["wind_effect"].isna(), "wind_effect"] = ref["wind_effect"].iloc[0]
        return group

    return long.groupby(["year", "bib"], group_keys=False).apply(_fill_finish)


# ---------------------------------------------------------------------------
# Orchestrierung
# ---------------------------------------------------------------------------

def enrich(long: pd.DataFrame, year: int, date: str, skip_weather: bool = False) -> pd.DataFrame:
    C.ensure_dirs()

    if skip_weather:
        print("[enrich] Wetter uebersprungen (--skip-weather)")
        for col in ["weather_time", "station_for_split", "station_name", "lat", "lon",
                    "date", "time", *C.HOURLY_VARS, "time_nmt", "weather_emoji", "lat2", "lon2"]:
            if col not in long.columns:
                long[col] = np.nan
    else:
        stations = load_stations()
        weather = build_weather_table(year, date)
        weather.to_csv(C.BUILD_DIR / f"{year}_openmeteo_by_station.csv", index=False)
        long = attach_weather(long, weather, stations)

    long = attach_elevation(long)
    long = attach_wind(long)
    long.to_csv(C.BUILD_DIR / f"{year}_long_enriched.csv", index=False)
    return long
