#Plot Norseman course (Swim/Bike/Run) from GPX files
#and overlay split points + weather stations.


from pathlib import Path

import gpxpy
import pandas as pd
import matplotlib.pyplot as plt


# CSV-Dateien
SPLITS_CSV = Path("/Users/manuelmiethke/Norseman_Bachelor/wetter_daten/split_points_lat_and_long.csv")
WEATHER_CSV = Path("/Users/manuelmiethke/Norseman_Bachelor/wetter_daten/weather_stations.csv")

# GPX-Dateien
SWIM_GPX = Path("/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_swim_route.gpx")
BIKE_GPX = Path("/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_bike_route.gpx")
RUN_GPX = Path("/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_run_route.gpx")

# Spaltennamen in den CSVs
# Splits
SPLIT_SEGMENT_COL = "segment"
SPLIT_LAT_COL = "lat"
SPLIT_LON_COL = "lon"
SPLIT_CUMKM_COL = "cum_km"      
SPLIT_NAME_COL = "split_name"   

# Wetterstationen
WEATHER_NAME_COL = "station_name"
WEATHER_LAT_COL = "lat"
WEATHER_LON_COL = "lon"

# Output-Dateien
OUTPUT_PNG = Path("norseman_course_with_weather.png")
OUTPUT_PDF = Path("norseman_course_with_weather.pdf")

# Farben für die Disziplinen (Streckenlinie)
DISCIPLINE_COLORS = {
    "swim": "tab:blue",
    "bike": "tab:red",
    "run": "tab:green",
}


# ==========================
# Hilfsfunktionen
# ==========================

def load_splits() -> pd.DataFrame:
    """Lädt die Splitpunkte und bereitet sie vor."""
    df = pd.read_csv(SPLITS_CSV)

    # Segment-Namen vereinheitlichen (lowercase, trim)
    df[SPLIT_SEGMENT_COL] = df[SPLIT_SEGMENT_COL].astype(str).str.strip().str.lower()

    # Koordinaten ohne NaN
    df = df.dropna(subset=[SPLIT_LAT_COL, SPLIT_LON_COL])

    # Nach cum_km sortieren, falls vorhanden
    if SPLIT_CUMKM_COL in df.columns:
        df = df.sort_values(SPLIT_CUMKM_COL)
    else:
        # Fallback: nach segment + lat/lon sortieren
        df = df.sort_values([SPLIT_SEGMENT_COL, SPLIT_LON_COL, SPLIT_LAT_COL])

    return df


def load_weather() -> pd.DataFrame:
    """Lädt Wetterstationsdaten."""
    df = pd.read_csv(WEATHER_CSV)
    df = df.dropna(subset=[WEATHER_LAT_COL, WEATHER_LON_COL])
    return df


def gpx_to_latlon(path: Path):
    """
    Liest eine GPX-Datei ein und gibt zwei Listen (lats, lons) zurück.
    Falls Datei nicht existiert, wird ([], []) zurückgegeben.
    """
    if not path.exists():
        print(f"[WARNUNG] GPX-Datei nicht gefunden: {path}")
        return [], []

    with path.open("r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    lats = []
    lons = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                lats.append(point.latitude)
                lons.append(point.longitude)

    return lats, lons


def collect_bounds(*coords_lists):
    """
    Berechnet min/max von lat/lon aus beliebig vielen (lats, lons)-Tupeln.
    coords_lists: Liste von Tupeln (lats, lons)
    """
    all_lats = []
    all_lons = []
    for lats, lons in coords_lists:
        all_lats.extend(lats)
        all_lons.extend(lons)

    if not all_lats or not all_lons:
        return None

    return min(all_lons), max(all_lons), min(all_lats), max(all_lats)


def cm_to_axes_offset(ax, dx_cm, dy_cm):
    """
    Wandle einen Versatz in Zentimetern in Daten-Koordinaten um.
    Der Versatz bezieht sich auf die Achsenfläche (nicht die ganze Figur).
    """
    fig = ax.get_figure()
    bbox = ax.get_position()  

    # Achsengröße in cm
    axis_w_cm = fig.get_figwidth() * 2.54 * bbox.width
    axis_h_cm = fig.get_figheight() * 2.54 * bbox.height

    if axis_w_cm == 0 or axis_h_cm == 0:
        return 0.0, 0.0

    # Anteil an der Achsenbreite/-höhe
    dx_axes = dx_cm / axis_w_cm
    dy_axes = dy_cm / axis_h_cm

    # Achsen-Koordinaten -> Daten-Koordinaten
    p0 = ax.transAxes.transform((0, 0))
    p1 = ax.transAxes.transform((dx_axes, dy_axes))
    inv = ax.transData.inverted()
    x0, y0 = inv.transform(p0)
    x1, y1 = inv.transform(p1)

    return x1 - x0, y1 - y0


# ==========================
# Plot-Funktion
# ==========================

def plot_course_with_weather(
    df_splits: pd.DataFrame,
    df_weather: pd.DataFrame,
    swim_coords,
    bike_coords,
    run_coords,
):
    """Plottet GPX-Strecke + Splitpunkte + Wetterstationen auf weißem Hintergrund."""
    swim_lats, swim_lons = swim_coords
    bike_lats, bike_lons = bike_coords
    run_lats, run_lons = run_coords

    plt.figure(figsize=(8, 10))  

    ax = plt.gca()
    ax.set_facecolor("white")

    # ------------ 1) GPX-Streckenverlauf je Disziplin ------------
    if swim_lats and swim_lons:
        ax.plot(
            swim_lons,
            swim_lats,
            linestyle="-",
            linewidth=1.5,
            color=DISCIPLINE_COLORS.get("swim", "blue"),
            alpha=0.8,
            label="Swim",
        )

    if bike_lats and bike_lons:
        ax.plot(
            bike_lons,
            bike_lats,
            linestyle="-",
            linewidth=1.5,
            color=DISCIPLINE_COLORS.get("bike", "red"),
            alpha=0.8,
            label="Bike",
        )

    if run_lats and run_lons:
        ax.plot(
            run_lons,
            run_lats,
            linestyle="-",
            linewidth=1.5,
            color=DISCIPLINE_COLORS.get("run", "green"),
            alpha=0.8,
            label="Run",
        )

    # ------------ 2) Split-Stationen (schwarze Punkte) ------------
    ax.scatter(
        df_splits[SPLIT_LON_COL],
        df_splits[SPLIT_LAT_COL],
        s=15,
        color="black",
        zorder=3,
        label="timing points",
    )

    # ------------ 3) Wetterstationen (blaue X) ------------
    ax.scatter(
        df_weather[WEATHER_LON_COL],
        df_weather[WEATHER_LAT_COL],
        s=60,
        marker="x",
        linewidths=2,
        color="blue",
        zorder=4,
        label="weather stations",
    )

    # ------------ 4) Achsen / Bounds / Aspect ------------
    bounds = collect_bounds(
        (swim_lats, swim_lons),
        (bike_lats, bike_lons),
        (run_lats, run_lons),
        (df_splits[SPLIT_LAT_COL].tolist(), df_splits[SPLIT_LON_COL].tolist()),
    )

    if bounds is not None:
        xmin, xmax, ymin, ymax = bounds
        padding = 0.02
        ax.set_xlim(xmin - padding, xmax + padding)
        ax.set_ylim(ymin - padding, ymax + padding)

    ax.set_aspect("equal", adjustable="datalim")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title("Norseman course with timing points and weather stations")

    # ------------ 6) Legende & Export ------------
    ax.legend(loc="best", frameon=True, fontsize=9)
    plt.tight_layout()

    print(f"Speichere PDF nach: {OUTPUT_PDF.resolve()}")
    plt.savefig(OUTPUT_PDF)

    plt.close()


# ==========================
# main
# ==========================

def main():
    print("Lade Splitpunkte...")
    splits = load_splits()

    print("Lade Wetterstationen...")
    weather = load_weather()

    print("Lade Swim-GPX...")
    swim_coords = gpx_to_latlon(SWIM_GPX)

    print("Lade Bike-GPX...")
    bike_coords = gpx_to_latlon(BIKE_GPX)

    print("Lade Run-GPX...")
    run_coords = gpx_to_latlon(RUN_GPX)

    # Plotten
    plot_course_with_weather(splits, weather, swim_coords, bike_coords, run_coords)
    print("Fertig.")


if __name__ == "__main__":
    main()
