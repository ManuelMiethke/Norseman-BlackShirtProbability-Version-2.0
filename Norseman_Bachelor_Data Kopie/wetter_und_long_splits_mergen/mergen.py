# Ziel: merge_weather_per_split_with_splitpoints.py

import pandas as pd
import numpy as np
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

# -------------------------------------------------------------------
# 1. Pfade
# -------------------------------------------------------------------

SPLITS_PATH = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long.csv"
WEATHER_PATH = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten/openmeteo_by_station.csv"
SPLITPOINTS_PATH = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten/split_points_lat_and_long.csv"
OUT_PATH = "nxtri_data_all_years_long_with_weather.csv"

# -------------------------------------------------------------------
# 2. Hilfsfunktionen
# -------------------------------------------------------------------

def fix_lat(val):
    """Lat aus komischen Formaten (z.B. '604.647.338', '598.655') in ~60.x umwandeln."""
    if pd.isna(val):
        return np.nan
    s = "".join(ch for ch in str(val) if ch.isdigit())
    if not s:
        return np.nan
    n = len(s)
    for k in [2, 1, 3]:
        if k >= n:
            continue
        v = float(s) / (10 ** (n - k))
        if 55 <= v <= 70:   
            return v
    v = float(s) / (10 ** max(n - 2, 1))
    return v

def fix_lon(val):
    """Lon aus Formaten wie '70.659.746', '86.978' in ~7.x / 8.x umwandeln."""
    if pd.isna(val):
        return np.nan
    s = "".join(ch for ch in str(val) if ch.isdigit())
    if not s:
        return np.nan
    n = len(s)
    for k in [1, 2, 3]:
        if k >= n:
            continue
        v = float(s) / (10 ** (n - k))
        if 0 <= v <= 30:
            return v
    v = float(s) / (10 ** max(n - 1, 1))
    return v

def haversine(lat1, lon1, lat2, lon2):
    """Distanz in km zwischen zwei Koordinaten."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

def format_hour(h):
    if pd.isna(h):
        return None
    return f"{int(h):02d}:00"

# -------------------------------------------------------------------
# 3. Daten einlesen
# -------------------------------------------------------------------
print("Lade Daten ...")
weather = pd.read_csv(WEATHER_PATH, sep=None, engine="python")
splits = pd.read_csv(SPLITS_PATH, sep=None, engine="python")
split_points = pd.read_csv(SPLITPOINTS_PATH, sep=None, engine="python")

# Jahr-Spalte in den Wetterdaten bereinigen
if "\ufeffyear" in weather.columns:
    weather = weather.rename(columns={"\ufeffyear": "year"})

# -------------------------------------------------------------------
# 4. Wetterstation-Koordinaten bereinigen
# -------------------------------------------------------------------
weather["lat2"] = weather["lat"].apply(fix_lat)
weather["lon2"] = weather["lon"].apply(fix_lon)

stations = (
    weather.dropna(subset=["lat2", "lon2"])
    .groupby("station_name")[["lat2", "lon2"]]
    .first()
    .reset_index()
)

print("Gefundene Wetterstationen:")
print(stations)

# -------------------------------------------------------------------
# 5. Split-Points -> nächste Wetterstation (per Distanz)
# -------------------------------------------------------------------
# split_key aus split_name ableiten (Suffix "_time" entfernen)
split_points["split_key"] = split_points["split_name"].str.replace("_time", "", regex=False)

stations_arr = stations[["lat2", "lon2"]].to_numpy()
station_names = stations["station_name"].tolist()

def nearest_station(lat, lon):
    if np.isnan(lat) or np.isnan(lon):
        return None
    dists = [haversine(lat, lon, slat, slon) for slat, slon in stations_arr]
    idx = int(np.argmin(dists))
    return station_names[idx]

split_points["nearest_station"] = [
    nearest_station(lat, lon) for lat, lon in split_points[["lat", "lon"]].to_numpy()
]

print("\nSplit-Points mit nächster Station (Auszug):")
print(split_points[["segment", "split_key", "lat", "lon", "nearest_station"]])

# -------------------------------------------------------------------
# 6. Station-Mapping pro split_key bauen + manuelle Ergänzungen
# -------------------------------------------------------------------
station_map = dict(zip(split_points["split_key"], split_points["nearest_station"]))

manual = {
    # Swim + T1 immer Eidfjord Swim mit 05:00
    "swim_finish": "Eidfjord Swim",
    "transition_1_in": "Eidfjord Swim",

    "bike_180km_finish": "Fyriegg",

    "run_32_5km_langefonn": "Gaustatoppen",
    "run_37_5km_stavsro_cut_off": "Gaustatoppen",
    "finish_black_t_shirt": "Gaustatoppen",
    "finish_white_t_shirt": "Gaustatoppen",
}
station_map.update(manual)

missing_splits = set(splits["split_key"].unique()) - set(station_map.keys())
if missing_splits:
    print("WARNUNG: Für folgende split_keys fehlt eine Station:", missing_splits)
else:
    print("\nAlle split_keys haben eine Station.")

splits["station_for_split"] = splits["split_key"].map(station_map)

# -------------------------------------------------------------------
# 7. Uhrzeit je Split berechnen
# -------------------------------------------------------------------
print("\nBerechne Uhrzeit pro Split ...")
splits["split_time_td"] = pd.to_timedelta(splits["split_time"])

RACE_START = pd.to_timedelta("05:00:00")
clock = RACE_START + splits["split_time_td"]
total_minutes = clock.dt.total_seconds() / 60.0

rounded_hours = np.round(total_minutes / 60.0)
splits["weather_time"] = [format_hour(h) for h in rounded_hours]

#Eidfjord Swim → immer 05:00 (Startzeit) für Wassertemperatur
mask_swim = splits["station_for_split"] == "Eidfjord Swim"
splits.loc[mask_swim, "weather_time"] = "05:00"

# -------------------------------------------------------------------
# 8. Merge Long-Splits × Wetter
# -------------------------------------------------------------------
print("\nMerge Splits mit Wetter ...")
merged = splits.merge(
    weather,
    how="left",
    left_on=["year", "station_for_split", "weather_time"],
    right_on=["year", "station_name", "time"],
    suffixes=("", "_wx"),
)

for col in ["temperature_2m", "wind_speed_10m", "precipitation"]:
    if col in merged.columns:
        merged[col] = (
            merged[col]
            .astype(str)
            .str.replace(",", ".", regex=False)
            .replace("nan", np.nan)
            .astype(float)
        )

print("\nBeispielzeilen nach Merge:")
print(
    merged[
        [
            "year",
            "bib",
            "split_key",
            "split_time",
            "station_for_split",
            "weather_time",
            "station_name",
            "time",
            "temperature_2m",
        ]
    ].head(30)
)

# -------------------------------------------------------------------
# 9. Speichern
# -------------------------------------------------------------------
print(f"\nSpeichere Ergebnis nach: {OUT_PATH}")
merged.to_csv(OUT_PATH, index=False)
print("Fertig.")
