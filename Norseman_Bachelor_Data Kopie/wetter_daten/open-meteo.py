"""
Norseman – Open-Meteo Fetcher
Lädt stündliche Wetterdaten (ERA5) für definierte Stationen und Renntermine.
Variablen: temperature_2m, cloud_cover, wind_speed_10m, wind_direction_10m,
           precipitation, weathercode (+ Emoji)
"""
import os, re
from datetime import datetime, timedelta
from typing import Optional, Tuple
import pandas as pd
import numpy as np

try:
    import requests
except Exception:
    raise SystemExit("Bitte 'requests' installieren: pip install requests")

RACE_DATES = {
    2018: "2018-08-04",
    2019: "2019-08-03",
    2021: "2021-08-07",
    2022: "2022-08-06",
    2024: "2024-08-03",
    2025: "2025-08-02",
}

WINDOW_DAYS_BEFORE = 0
WINDOW_DAYS_AFTER  = 0

TIMEZONE = "Europe/Oslo"

# ------------------------ Open-Meteo Variablen ------------------------
HOURLY_VARS = [
    "temperature_2m",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "precipitation",
    "weathercode"
]

API = "https://archive-api.open-meteo.com/v1/era5"

# ------------------------ Helpers ------------------------
def weathercode_to_emoji(code: Optional[int]) -> str:
    if code is None or (isinstance(code, float) and np.isnan(code)):
        return ""
    code = int(code)
    if code == 0: return "☀️"
    if code in (1, 2, 3): return "⛅"
    if code in (45, 48): return "🌫️"
    if code in (51, 53, 55, 56, 57): return "🌦️"
    if code in (61, 63, 65, 66, 67): return "🌧️"
    if code in (71, 73, 75, 77): return "❄️"
    if code in (80, 81, 82): return "🌧️"
    if code in (85, 86): return "🌨️"
    if code == 95: return "⛈️"
    if code in (96, 99): return "⛈️🧊"
    return "🌡️"

def build_date_window(date_str: str) -> Tuple[str, str]:
    d = datetime.strptime(date_str, "%Y-%m-%d")
    start = (d - timedelta(days=WINDOW_DAYS_BEFORE)).strftime("%Y-%m-%d")
    end   = (d + timedelta(days=WINDOW_DAYS_AFTER)).strftime("%Y-%m-%d")
    return start, end

def fetch_open_meteo(lat: float, lon: float, start_date: str, end_date: str, tz: str) -> pd.DataFrame:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARS),
        "start_date": start_date,
        "end_date": end_date,
        "timezone": tz
    }
    r = requests.get(API, params=params, timeout=60)
    r.raise_for_status()
    data = r.json()
    if "hourly" not in data or "time" not in data["hourly"]:
        raise ValueError(f"API Antwort ohne 'hourly' für {lat},{lon}: {data}")
    h = data["hourly"]
    df = pd.DataFrame(h)
    # Zeitspalte
    df["time_nmt"] = pd.to_datetime(df["time"])
    df = df.drop(columns=["time"])
    # Datum links, Uhrzeit rechts
    df.insert(0, "date", df["time_nmt"].dt.date.astype(str))
    df.insert(1, "time", df["time_nmt"].dt.strftime("%H:%M"))
    return df

def load_stations(path: str = "wetter_daten_neuer_verusch/stations.csv") -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} nicht gefunden. Lege eine CSV mit Spalten station_name,lat,lon an.")
    df = pd.read_csv(path)
    # flexible Spaltensuche
    cols = list(df.columns)
    def find_col(*pats):
        for pat in pats:
            for c in cols:
                if re.search(pat, str(c), flags=re.I):
                    return c
        return None
    sname = find_col(r"^station_name$", r"station.*name", r"name")
    latc  = find_col(r"^lat$", r"latitude")
    lonc  = find_col(r"^lon$", r"longitude")
    if not (sname and latc and lonc):
        raise ValueError("Erwarte Spalten station_name, lat, lon.")
    out = (df[[sname, latc, lonc]]
           .dropna()
           .rename(columns={sname:"station_name", latc:"lat", lonc:"lon"})
           .drop_duplicates())
    return out

# ------------------------ Main ------------------------
def main():
    stations = load_stations("wetter_daten_neuer_verusch/stations.csv")
    print(f"{len(stations)} Station(en) geladen.")
    out_rows = []

    for year, day in RACE_DATES.items():
        start_date, end_date = build_date_window(day)
        for _, s in stations.iterrows():
            sn, lat, lon = s["station_name"], float(s["lat"]), float(s["lon"])
            print(f"Hole {year} {sn} ({lat:.4f},{lon:.4f}) {start_date}→{end_date}")
            df = fetch_open_meteo(lat, lon, start_date, end_date, TIMEZONE)
            df.insert(0, "year", year)
            df.insert(1, "station_name", sn)
            df.insert(2, "lat", lat)
            df.insert(3, "lon", lon)
            if "weathercode" in df.columns:
                df["weather_emoji"] = df["weathercode"].map(weathercode_to_emoji)
            out_rows.append(df)

    if not out_rows:
        raise SystemExit("Keine Daten geladen.")
    by_station = pd.concat(out_rows, ignore_index=True)

    agg = (by_station
           .groupby(["year","time_nmt"], as_index=False)
           .agg(course_temp_mean=("temperature_2m","mean"),
                course_temp_min=("temperature_2m","min"),
                course_temp_max=("temperature_2m","max"),
                course_cloud_mean=("cloud_cover","mean"),
                course_wind_speed_mean=("wind_speed_10m","mean"),
                course_wind_dir_mean=("wind_direction_10m","mean"),
                course_precip_sum=("precipitation","sum"),
                stations_used=("temperature_2m","count")))
    agg.insert(1, "date", pd.to_datetime(agg["time_nmt"]).dt.date.astype(str))
    agg.insert(2, "time", pd.to_datetime(agg["time_nmt"]).dt.strftime("%H:%M"))

    by_station = by_station.sort_values(["year","station_name","time_nmt"]).reset_index(drop=True)
    agg = agg.sort_values(["year","time_nmt"]).reset_index(drop=True)

    out1 = "openmeteo_by_station.csv"
    out2 = "openmeteo_course_hourly.csv"
    by_station.to_csv(out1, index=False)
    agg.to_csv(out2, index=False)
    print("Fertig.")
    print(out1)
    print(out2)

if __name__ == "__main__":
    main()
