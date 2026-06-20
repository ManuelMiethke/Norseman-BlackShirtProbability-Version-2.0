import pandas as pd
from pathlib import Path


LONG_FILE = "nxtri_data_all_years_long.csv"
SPLIT_POINTS_FILE = "split_points.csv"
WEATHER_FILE = "openmeteo_by_station.xls"  

OUT_FILE = "nxtri_data_all_years_long_weather.csv"

RACE_DATES = {
    2018: "2018-08-04",
    2019: "2019-08-03",
    2021: "2021-08-07",
    2022: "2022-08-06",
    2023: "2023-08-05",
    2024: "2024-08-03",
    2025: "2025-08-02",
}

RACE_START_TIME = "05:00:00"  


# ----------------------------
# 1) Load data
# ----------------------------

print("Loading long splits...")
df_long = pd.read_csv(LONG_FILE)

print("Loading split lookup (split_points)...")
df_splits = pd.read_csv(SPLIT_POINTS_FILE)

print("Loading weather data (openmeteo)...")
df_weather = pd.read_excel(WEATHER_FILE)  


# ----------------------------
# 2) Prepare split lookup
# ----------------------------
if "source_column" in df_splits.columns:
    df_splits["split_key"] = df_splits["source_column"].str.replace("_time", "", regex=False)
elif "split_key" in df_splits.columns:
    pass
else:
    raise ValueError("In split_points.csv wird eine Spalte 'source_column' oder 'split_key' benötigt.")

# Kontrollausgabe
print("Beispiel Split-Lookup:")
print(df_splits.head())


# ----------------------------
# 3) Merge long splits with split lookup (Koordinaten, Segment etc.)
# ----------------------------

df_long = df_long.merge(
    df_splits[["split_key", "segment", "split_name", "km_marker", "cum_km", "lat", "lon"]],
    on="split_key",
    how="left"
)

print("Nach Merge mit split_points hat df_long folgende Spalten:")
print(df_long.columns)


# ----------------------------
# 4) Build race_start_datetime per row
# ----------------------------

if "race_date" not in df_long.columns:
    print("Erzeuge 'race_date' aus year über Mapping RACE_DATES...")
    df_long["race_date"] = df_long["year"].map(RACE_DATES)

if df_long["race_date"].isna().any():
    missing_years = df_long.loc[df_long["race_date"].isna(), "year"].unique()
    raise ValueError(f"Für folgende Jahre fehlt ein Eintrag in RACE_DATES: {missing_years}")

df_long["race_start_datetime"] = pd.to_datetime(df_long["race_date"] + " " + RACE_START_TIME)

# ----------------------------
# 5) Convert split_time to timedelta & build absolute split_timestamp
# ----------------------------

print("Konvertiere split_time zu Timedelta...")
df_long["split_duration"] = pd.to_timedelta(df_long["split_time"])

df_long["split_timestamp"] = df_long["race_start_datetime"] + df_long["split_duration"]

print("Beispiel-Zeiten:")
print(df_long[["year", "bib", "split_key", "split_time", "race_start_datetime", "split_timestamp"]].head())


# ----------------------------
# 6) Prepare weather data
# ----------------------------

possible_time_cols = [c for c in df_weather.columns if c.lower() in ("time", "datetime", "date", "valid_time")]
if not possible_time_cols:
    raise ValueError("Konnte keine Zeitspalte in der Wetterdatei finden. Bitte Spaltennamen prüfen.")
time_col = possible_time_cols[0]
print(f"Nutze '{time_col}' als Wetter-Zeitspalte.")

df_weather["weather_datetime"] = pd.to_datetime(df_weather[time_col])

possible_station_cols = [c for c in df_weather.columns if c.lower() in ("station", "station_id", "name")]
if not possible_station_cols:
    raise ValueError("Konnte keine Stationsspalte in der Wetterdatei finden. Bitte Spaltennamen prüfen.")
station_col = possible_station_cols[0]
print(f"Nutze '{station_col}' als Stationsspalte.")

df_weather = df_weather.rename(columns={
    station_col: "station",
})

df_weather = df_weather.sort_values(["station", "weather_datetime"])


# ----------------------------
# 7) Station-Mapping
# ----------------------------

if "station" in df_splits.columns:
    print("Nutze 'station' aus split_points als Station-Mapping...")
    df_long = df_long.drop(columns=[c for c in df_long.columns if c == "station"])
    df_long = df_long.merge(
        df_splits[["split_key", "station"]],
        on="split_key",
        how="left"
    )
else:
    print("WARNUNG: split_points.csv hat keine 'station'-Spalte.")
    print("Du solltest in split_points.csv für jeden split_key eine passende Wetterstation eintragen.")
    raise ValueError("Bitte füge in split_points.csv eine Spalte 'station' hinzu und weise jedem Split eine Station zu.")


# ----------------------------
# 8) merge_asof: match split_timestamp to nearest weather time (per station)
# ----------------------------

print("Vorbereitung für merge_asof...")

df_long = df_long.sort_values(["station", "split_timestamp"])

df_merged = pd.merge_asof(
    df_long,
    df_weather,
    left_on="split_timestamp",
    right_on="weather_datetime",
    by="station",
    direction="nearest",
    tolerance=pd.Timedelta("1H")  
)

print("Beispiel nach merge_asof:")
print(df_merged[["year", "bib", "split_key", "split_timestamp", "station", "weather_datetime"]].head())


# ----------------------------
# 9) Save result
# ----------------------------

df_merged.to_csv(OUT_FILE, index=False)
print(f"FERTIG! Datei mit Wetter-Mapping gespeichert als: {OUT_FILE}")
