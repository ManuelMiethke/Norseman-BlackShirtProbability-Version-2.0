"""
Zentrale Konfiguration der automatisierten Norseman-ETL.

Alles, was sich von Jahr zu Jahr aendern kann, steht hier - der Rest der
Pipeline liest nur noch aus diesem Modul.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Pfade
# ---------------------------------------------------------------------------

ETL_DIR = Path(__file__).resolve().parent
DATA_REPO = ETL_DIR.parent                       # "Norseman_Bachelor_Data Kopie"
PROJECT_ROOT = DATA_REPO.parent                  # "Norseman Dashboard Version 2"

# Dashboard-Repo (Ordnername kann variieren -> zur Laufzeit gesucht)
def _find_dashboard_assets() -> Path | None:
    for candidate in sorted(PROJECT_ROOT.glob("*/dashboard/assets")):
        if (candidate / "nxtri_data_all_years.csv").exists():
            return candidate
    return None


DASHBOARD_ASSETS = _find_dashboard_assets()

# Rohdaten / Zwischenstaende / Reports
RAW_DIR = ETL_DIR / "raw"
BUILD_DIR = ETL_DIR / "build"
REPORT_DIR = ETL_DIR / "reports"
BACKUP_DIR = ETL_DIR / "backups"

# Referenzdaten aus dem bestehenden Repo
SPLIT_POINTS_CSV = DATA_REPO / "wetter_daten" / "split_points_lat_and_long.csv"
WEATHER_STATIONS_CSV = DATA_REPO / "wetter_daten" / "weather_stations.csv"
OPENMETEO_BY_STATION_CSV = DATA_REPO / "wetter_daten" / "openmeteo_by_station.csv"
SPLIT_ELEVATION_CSV = DATA_REPO / "GPX_data" / "split_elevation_grade.csv"

# Master-Dateien (Ziel des Merge-Schritts)
MASTER_WIDE = DASHBOARD_ASSETS / "nxtri_data_all_years.csv" if DASHBOARD_ASSETS else None
MASTER_LONG = (
    DASHBOARD_ASSETS / "nxtri_data_all_years_long_ready_featured.csv"
    if DASHBOARD_ASSETS
    else None
)

# ---------------------------------------------------------------------------
# Renn-Stammdaten
# ---------------------------------------------------------------------------

RACE_DATES = {
    2018: "2018-08-04",
    2019: "2019-08-03",
    2021: "2021-08-07",
    2022: "2022-08-06",
    2024: "2024-08-03",
    2025: "2025-08-02",
    2026: "2026-08-01",
}

RACE_START_TIME = "05:00:00"
TIMEZONE = "Europe/Oslo"

# Bekannte RACE-RESULT-Event-IDs (werden durch discover_event_id ergaenzt)
KNOWN_EVENT_IDS = {
    2025: 321377,
    2026: 393558,
}

SWIM_KM = 3.8
BIKE_KM = 180.0
FINISH_RUN_KM = 42.2
PRE_RUN_KM = SWIM_KM + BIKE_KM
COURSE_KM = SWIM_KM + BIKE_KM + FINISH_RUN_KM  # 226.0


@dataclass(frozen=True)
class RaceYear:
    year: int
    race_date: str
    cutoff_split_key: str = "run_37_5km_stavsro_cut_off"
    cutoff_run_km: float = 37.5
    finish_distance_km: float = 221.3
    event_id: int | None = None


TARGET_YEAR = 2026

RACE_YEAR = RaceYear(
    year=TARGET_YEAR,
    race_date=RACE_DATES[TARGET_YEAR],
    cutoff_split_key="run_37_5km_stavsro_cut_off",
    cutoff_run_km=37.5,
    finish_distance_km=221.3,
    event_id=None,  # wird automatisch ermittelt, kann per CLI ueberschrieben werden
)

# ---------------------------------------------------------------------------
# Split-Mapping: RACE-RESULT-Splitname -> historischer Spaltenname (ohne "_time")
# ---------------------------------------------------------------------------

SPLIT_NAME_MAP: dict[str, str] = {
    "SWIM_FINISH": "swim_finish",
    "T1_IN": "transition_1_in",
    "T1_OUT": "bike_start",
    "OVRE_EIDFJORD": "bike_6km_ovre_eidfjord",
    "ENTER_GAMLEVEGEN": "bike_11km_enter_gamlevegen",
    "VORINGSFOSSEN": "bike_16km_voringfossen",
    "BEGIN_SUPPORT": "bike_20km_garen",
    "BJOREIO_28K": "bike_28km_bjoreio",
    "DYRANUT": "bike_36km_dyranut",
    "HALNE": "bike_47km_halne",
    "HAUGASTOL": "bike_66km_haugastol",
    "GEILO": "bike_90km_geilo",
    "KIKUT": "bike_94km_kikut",
    "SKURDALEN": "bike_101km_skurdalen",
    "DAGALI": "bike_113km_dagali",
    "VASSTULAN": "bike_123km_vasstulan",
    "IMINGFJELL_START": "bike_134km_start_imingfjell",
    "IMINGFJELL": "bike_142km_top_imingfjell",
    "END_SUPPORT": "bike_152km_end_imingfjell",
    "AUSTBYGDEKIRKE": "bike_179km_austbygde",
    "T2_IN": "bike_180km_finish",
    "T2_OUT": "run_start",
    "RUN_5K_ATRAA": "run_5km_atraa",
    "RUN_10K": "run_10km",
    "RUN_15K_TINNSJO": "run_15km_tinnsjo",
    "RUN_20K_MILAND": "run_20km_miland",
    "RUN_25K_ZH_START": "run_25km_zombie_hill_base",
    "ZOMBIE_HILL_TURN1": "run_zombie_hill_1st_turn",
    "ZOMBIE_HILL_TURN2": "run_zombie_hill_2nd_turn",
    "ZOMBIE_HILL_TURN3": "run_zombie_hill_3rd_turn",
    "ZOMBIE_HILL_TURN4": "run_zombie_hill_4th_turn",
    "ZOMBIE_HILL_TURN5": "run_zombie_hill_5th_turn",
    "RUN_32K": "run_32_5km_langefonn",
    "STAVSRO_CUTOFF": "run_37_5km_stavsro_cut_off",
    "RUN_40K_MOUNTAIN": "run_40km_right_before_mt_gaustatoppen",
    "FINISH_BLACK": "finish_black_t_shirt",
    "FINISH_WHITE": "finish_white_t_shirt",
    # 2025 neu hinzugekommen, existiert historisch nicht -> bewusst ignoriert
    "SVINEROI": None,
}

# Leg-Summen (SplitType 9 in der RACE-RESULT-Config)
LEG_SPLIT_MAP: dict[str, str] = {
    "SWIM": "swim",
    "T1": "t1",
    "BIKE": "bike",
    "T2": "t2",
    "RUN": "run",
}

# Reihenfolge der Stationen im Wide-Format (= Reihenfolge auf der Strecke)
STATION_ORDER: list[str] = [
    "swim_finish",
    "transition_1_in",
    "bike_start",
    "bike_6km_ovre_eidfjord",
    "bike_11km_enter_gamlevegen",
    "bike_16km_voringfossen",
    "bike_20km_garen",
    "bike_28km_bjoreio",
    "bike_36km_dyranut",
    "bike_47km_halne",
    "bike_66km_haugastol",
    "bike_90km_geilo",
    "bike_94km_kikut",
    "bike_101km_skurdalen",
    "bike_113km_dagali",
    "bike_123km_vasstulan",
    "bike_134km_start_imingfjell",
    "bike_142km_top_imingfjell",
    "bike_152km_end_imingfjell",
    "bike_179km_austbygde",
    "bike_180km_finish",
    "run_start",
    "run_5km_atraa",
    "run_10km",
    "run_15km_tinnsjo",
    "run_20km_miland",
    "run_25km_zombie_hill_base",
    "run_zombie_hill_1st_turn",
    "run_zombie_hill_2nd_turn",
    "run_zombie_hill_3rd_turn",
    "run_zombie_hill_4th_turn",
    "run_zombie_hill_5th_turn",
    "run_32_5km_langefonn",
    "run_37_5km_stavsro_cut_off",
    "run_40km_right_before_mt_gaustatoppen",
    "finish_black_t_shirt",
    "finish_white_t_shirt",
]

# Kumulative Streckendistanz je Station (km ab Schwimmstart).
# Basis: split_points_lat_and_long.csv + zombie_run_km aus neue_features.py
STATION_CUM_KM: dict[str, float] = {
    "swim_finish": SWIM_KM,
    "transition_1_in": SWIM_KM,
    "bike_start": SWIM_KM,
    "bike_6km_ovre_eidfjord": SWIM_KM + 6.0,
    "bike_11km_enter_gamlevegen": SWIM_KM + 11.0,
    "bike_16km_voringfossen": SWIM_KM + 16.0,
    "bike_20km_garen": SWIM_KM + 20.0,
    "bike_28km_bjoreio": SWIM_KM + 28.0,
    "bike_36km_dyranut": SWIM_KM + 36.0,
    "bike_47km_halne": SWIM_KM + 47.0,
    "bike_66km_haugastol": SWIM_KM + 66.0,
    "bike_90km_geilo": SWIM_KM + 90.0,
    "bike_94km_kikut": SWIM_KM + 94.0,
    "bike_101km_skurdalen": SWIM_KM + 101.0,
    "bike_113km_dagali": SWIM_KM + 113.0,
    "bike_123km_vasstulan": SWIM_KM + 123.0,
    "bike_134km_start_imingfjell": SWIM_KM + 134.0,
    "bike_142km_top_imingfjell": SWIM_KM + 142.0,
    "bike_152km_end_imingfjell": SWIM_KM + 152.0,
    "bike_179km_austbygde": SWIM_KM + 179.0,
    "bike_180km_finish": SWIM_KM + BIKE_KM,
    "run_start": PRE_RUN_KM,
    "run_5km_atraa": PRE_RUN_KM + 5.0,
    "run_10km": PRE_RUN_KM + 10.0,
    "run_15km_tinnsjo": PRE_RUN_KM + 15.0,
    "run_20km_miland": PRE_RUN_KM + 20.0,
    "run_25km_zombie_hill_base": PRE_RUN_KM + 25.0,
    "run_zombie_hill_1st_turn": PRE_RUN_KM + 26.75,
    "run_zombie_hill_2nd_turn": PRE_RUN_KM + 27.90,
    "run_zombie_hill_3rd_turn": PRE_RUN_KM + 29.10,
    "run_zombie_hill_4th_turn": PRE_RUN_KM + 30.50,
    "run_zombie_hill_5th_turn": PRE_RUN_KM + 31.00,
    "run_32_5km_langefonn": PRE_RUN_KM + 32.5,
    "run_37_5km_stavsro_cut_off": PRE_RUN_KM + 37.5,
    "run_40km_right_before_mt_gaustatoppen": PRE_RUN_KM + 40.0,
    "finish_black_t_shirt": PRE_RUN_KM + FINISH_RUN_KM,
    "finish_white_t_shirt": PRE_RUN_KM + 32.5,
}

# Stationen, an denen sich der Athlet definitionsgemaess nicht bewegt
ZERO_DISTANCE_STATIONS = {"transition_1_in", "bike_start", "run_start"}

# Stationen, die nur ein Teil des Feldes erreicht -> nie interpolieren
NON_INTERPOLATABLE = {
    "finish_black_t_shirt",
    "finish_white_t_shirt",
    "run_40km_right_before_mt_gaustatoppen",
}

# ---------------------------------------------------------------------------
# Plausibilitaets-Grenzen fuer die Validierung (Segment-Geschwindigkeit km/h)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SpeedBounds:
    hard_min: float   # darunter = sicher falsch -> Auto-Fix
    soft_min: float   # darunter = verdaechtig  -> Report
    soft_max: float
    hard_max: float


SPEED_BOUNDS: dict[str, SpeedBounds] = {
    # Schwimmen: Weltklasse ~4.0 km/h, Schlusslicht ~1.5 km/h
    "swim": SpeedBounds(hard_min=1.0, soft_min=1.8, soft_max=4.5, hard_max=6.0),
    # Rad flach bis wellig
    "bike": SpeedBounds(hard_min=3.0, soft_min=8.0, soft_max=55.0, hard_max=75.0),
    # Rad bergauf: Voringfossen hat 8 % ueber 5 km, das Feldende faehrt dort 5-8 km/h.
    # Nach oben grosszuegig, weil die Spitze bei 4 % Steigung noch 34 km/h faehrt.
    "bike_climb": SpeedBounds(hard_min=1.5, soft_min=3.0, soft_max=36.0, hard_max=48.0),
    # Rad bergab: 152 -> 179 km sind 27 km mit -930 Hoehenmetern
    "bike_descent": SpeedBounds(hard_min=5.0, soft_min=15.0, soft_max=75.0, hard_max=95.0),
    # Laufen flach
    "run": SpeedBounds(hard_min=1.0, soft_min=3.0, soft_max=20.0, hard_max=25.0),
    # Zombie Hill / Gaustatoppen: Gehen ist normal
    "run_steep": SpeedBounds(hard_min=0.5, soft_min=1.5, soft_max=13.0, hard_max=18.0),
}

# Ab dieser Durchschnittssteigung gilt ein Segment als Anstieg bzw. Abfahrt
CLIMB_GRADE_PCT = 4.0
DESCENT_GRADE_PCT = -2.5
STEEP_GRADE_PCT = 6.0        # nur fuer das Laufen

# Auf sehr kurzen Segmenten dominiert die Ungenauigkeit des Streckenmodells die
# gemessene Zeit - dort greift statt der Tempo-Pruefung der MAD-Ausreissertest,
# der ohne Distanzannahme auskommt.
#
# Hintergrund: die Zombie-Hill-Kehren stehen in neue_features.py bei
# 26,75 / 27,90 / 29,10 / 30,50 / 31,00 km, im GPX-Profil dagegen bei
# 26 / 27 / 28 / 29 / 30 km. Die Abweichung steckt seit 2018 in den Daten;
# sie hier zu korrigieren wuerde 2026 mit den Vorjahren unvergleichbar machen.
SHORT_SEGMENT_KM = 2.0

# Transitions: absolute Dauer in Sekunden
T_MIN_SECONDS = 5
T_MAX_SECONDS = 60 * 45

# ---------------------------------------------------------------------------
# Wetter
# ---------------------------------------------------------------------------

OPENMETEO_API = "https://archive-api.open-meteo.com/v1/era5"
OPENMETEO_FORECAST_API = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARS = [
    "temperature_2m",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "precipitation",
    "weathercode",
]

# Manuelle Station-Zuordnung (aus wetter_und_long_splits_mergen/mergen.py)
MANUAL_STATION_MAP = {
    "swim_finish": "Eidfjord Swim",
    "transition_1_in": "Eidfjord Swim",
    "bike_180km_finish": "Fyriegg",
    "run_32_5km_langefonn": "Gaustatoppen",
    "run_37_5km_stavsro_cut_off": "Gaustatoppen",
    "finish_black_t_shirt": "Gaustatoppen",
    "finish_white_t_shirt": "Gaustatoppen",
}

# Bewegungsrichtung je Split (aus new_data/wind_effect.py)
BIKE_WEST_KEYS = {
    "bike_start",
    "bike_6km_ovre_eidfjord",
    "bike_11km_enter_gamlevegen",
    "bike_16km_voringfossen",
    "bike_20km_garen",
    "bike_28km_bjoreio",
    "bike_36km_dyranut",
    "bike_47km_halne",
    "bike_66km_haugastol",
    "bike_90km_geilo",
    "bike_94km_kikut",
}

BIKE_SOUTH_KEYS = {
    "bike_101km_skurdalen",
    "bike_113km_dagali",
    "bike_123km_vasstulan",
    "bike_134km_start_imingfjell",
    "bike_142km_top_imingfjell",
    "bike_152km_end_imingfjell",
    "bike_179km_austbygde",
    "bike_180km_finish",
}


def ensure_dirs() -> None:
    for d in (RAW_DIR, BUILD_DIR, REPORT_DIR, BACKUP_DIR):
        d.mkdir(parents=True, exist_ok=True)
