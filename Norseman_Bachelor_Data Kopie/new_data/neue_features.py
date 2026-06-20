import pandas as pd
import numpy as np
import re

# -------------------------------------------------
# Pfade
# -------------------------------------------------
IN_FILE = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long.csv"
OUT_FILE = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_ready_features_v4.csv"

# Konstanten
SWIM_KM = 3.8
BIKE_KM = 180.0
FINISH_RUN_KM = 42.2              
PRE_RUN_KM = SWIM_KM + BIKE_KM    
COURSE_KM = SWIM_KM + BIKE_KM + FINISH_RUN_KM  

# GPX-basierte Run-Distanzen für Zombie Hill
zombie_run_km = {
    "run_zombie_hill_1st_turn":   26.75,
    "run_zombie_hill_2nd_turn":   27.90,
    "run_zombie_hill_3rd_turn":   29.10,
    "run_zombie_hill_4th_turn":   30.50,
    "run_zombie_hill_5th_turn":   31.00,
    "run_32_5km_langefonn":       32.50,
    "run_25km_zombie_hill_base":  25.00,
}

finish_keys = [
    "finish_black_t_shirt",
    "finish_white_t_shirt",
]

# -------------------------------------------------
# 1) Daten laden
# -------------------------------------------------
df = pd.read_csv(IN_FILE, low_memory=False)

# Zeitspalte in Timedelta
df["split_time_td"] = pd.to_timedelta(df["split_time_td"])

# sicherstellen, dass split_rank numerisch ist
df["split_rank"] = pd.to_numeric(df["split_rank"], errors="coerce")

# -------------------------------------------------
# 2) Leg + Leg-Distanz aus split_key extrahieren
# -------------------------------------------------
def extract_leg_dist(key):
    if pd.isna(key):
        return "other", np.nan

    key_low = str(key).lower()

    # 0) Transitions explizit behandeln
    if (
        "transition" in key_low
        or key_low.startswith("t1")
        or key_low.startswith("t2")
        or "t1_" in key_low
        or "t2_" in key_low
    ):
        return "transition", 0.0

    # 1) Finish-Splits: Run-Ende bei 42.3 km
    if key_low in finish_keys:
        return "run", FINISH_RUN_KM

    # 2) Zombie-Hill-Splits per GPX
    if key_low in zombie_run_km:
        return "run", zombie_run_km[key_low]

    # 3) Leg bestimmen
    if key_low.startswith("swim"):
        leg = "swim"
    elif key_low.startswith("bike"):
        leg = "bike"
    elif key_low.startswith("run"):
        leg = "run"
    else:
        leg = "other"

    # 4) generische km-Extraktion, z.B. "6km", "32_5km", "180km"
    m = re.search(r"(\d+[_\.\d]*)km", key_low)
    if m:
        val = m.group(1).replace("_", ".")
        try:
            dist = float(val)
            return leg, dist
        except ValueError:
            pass

    # 5) Fallbacks ohne explizite km
    if leg == "swim":
        if "finish" in key_low:
            return "swim", SWIM_KM
        else:
            return "swim", 0.0

    if leg == "bike":
        if "finish" in key_low:
            return "bike", BIKE_KM
        if "start" in key_low:
            return "bike", 0.0
        return "bike", np.nan

    if leg == "run":
        if "start" in key_low:
            return "run", 0.0
        return "run", np.nan

    return "other", np.nan


legs = []
leg_dists = []
for key in df["split_key"]:
    L, D = extract_leg_dist(key)
    legs.append(L)
    leg_dists.append(D)

df["leg"] = legs
df["leg_distance_km"] = leg_dists

# -------------------------------------------------
# 3) Absolute Kursdistanz (0–226.1 km)
# -------------------------------------------------
def absolute_distance(row):
    leg = row["leg"]
    d = row["leg_distance_km"]

    if pd.isna(d):
        return np.nan

    if leg == "swim":
        return d
    if leg == "bike":
        return SWIM_KM + d
    if leg == "run":
        return PRE_RUN_KM + d

    return np.nan


df["split_distance_km"] = df.apply(absolute_distance, axis=1)

# -------------------------------------------------
# 4) Segment-Features (Zeit, Distanz, Speed, Deltas)
# -------------------------------------------------
df = df.sort_values(["year", "bib", "split_time_td"])

def add_segment_features(group: pd.DataFrame) -> pd.DataFrame:
    group = group.sort_values("split_time_td")

    # Distanzen innerhalb der Gruppe auffüllen (Transitions, Starts)
    dist = group["split_distance_km"].copy()
    dist = dist.ffill().bfill()
    group["split_distance_km"] = dist

    # kumulative Zeit in Sekunden
    cum_sec = group["split_time_td"].dt.total_seconds()
    group["cum_time_seconds"] = cum_sec

    # Segmentzeit
    seg_t = cum_sec.diff()
    seg_t.iloc[0] = cum_sec.iloc[0]
    group["segment_time_s"] = seg_t

    # Segmentdistanz
    seg_d = dist.diff()
    seg_d.iloc[0] = dist.iloc[0]
    group["segment_distance_km"] = seg_d

    # Segmentgeschwindigkeit
    with np.errstate(divide="ignore", invalid="ignore"):
        seg_speed = seg_d / (seg_t / 3600.0)
    seg_speed = seg_speed.replace([np.inf, -np.inf], np.nan)
    group["segment_speed_kmh"] = seg_speed

    # Delta Rank
    group["delta_rank"] = group["split_rank"].diff().fillna(0)

    # Delta Speed
    group["delta_speed"] = seg_speed.diff().fillna(0)

    return group


df = df.groupby(["year", "bib"], group_keys=False).apply(add_segment_features)

# -------------------------------------------------
# 5) Elevation bei Segmenten ohne Bewegung und bei Swim-Finish auf 0 setzen
# -------------------------------------------------
zero_segment = df["segment_distance_km"] == 0
is_swim_finish = df["leg"].eq("swim") & df["station_name"].str.lower().str.contains("swim")

elev_zero_mask = zero_segment | is_swim_finish

for col in ["elev_gain_m", "elev_loss_m", "net_elev_m", "avg_grade_pct"]:
    if col in df.columns:
        df.loc[elev_zero_mask, col] = 0

# -------------------------------------------------
# 6) movement_direction_deg & wind_effect am Finish
#     aus run_40km_right_before_mt_gaustatoppen übernehmen
# -------------------------------------------------
def fill_finish_wind(group: pd.DataFrame) -> pd.DataFrame:
    mask_before = group["split_key"] == "run_40km_right_before_mt_gaustatoppen"
    if not mask_before.any():
        return group

    ref_dir = group.loc[mask_before, "movement_direction_deg"].iloc[0]
    ref_wind = group.loc[mask_before, "wind_effect"].iloc[0]

    mask_finish = group["split_key"].isin([
        "finish_black_t_shirt",
        "finish_white_t_shirt"
    ])

    group.loc[mask_finish & group["movement_direction_deg"].isna(), "movement_direction_deg"] = ref_dir
    group.loc[mask_finish & group["wind_effect"].isna(), "wind_effect"] = ref_wind

    return group

df = df.groupby(["year", "bib"], group_keys=False).apply(fill_finish_wind)

# -------------------------------------------------
# 7) Runden & progress_perc berechnen
# -------------------------------------------------
df["split_distance_km"] = df["split_distance_km"].round(2)
df["segment_distance_km"] = df["segment_distance_km"].round(2)
df["segment_speed_kmh"] = df["segment_speed_kmh"].round(2)

df["progress_perc"] = (df["split_distance_km"] / COURSE_KM).clip(0, 1)

# -------------------------------------------------
# 8) Speichern
# -------------------------------------------------
df.to_csv(OUT_FILE, index=False)
print("Fertig. Neue Datei gespeichert unter:", OUT_FILE)
