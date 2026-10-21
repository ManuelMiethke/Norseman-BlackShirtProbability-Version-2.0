/**
 * Builds the public data folder the dashboard is served from (.public-data/).
 *
 * Source: the Streamlit assets folder. Each CSV is reduced to the columns the
 * React app actually reads. That keeps the download small and – because the
 * app shows anonymised labels anyway – athlete names never leave the repo in
 * the published site.
 *
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(here, "../../Norseman_Bachelor_Dashboard_only Kopie 2/dashboard/assets");
const TARGET = path.resolve(here, "../.public-data");

/** Columns read by src/hooks/use*Data.ts – keep in sync when a hook reads a new field. */
const CSV_FILES = {
  "nxtri_data_all_years.csv": [
    "year", "bib", "gender", "country", "club", "finish_type", "overall_rank", "overall_time",
    "swim_time", "t1_time", "bike_time", "t2_time", "run_time", "zombie_hill_time",
    "run_start_time", "run_32_5km_langefonn_time", "run_37_5km_stavsro_cut_off_time",
  ],
  "nxtri_data_all_years_long_ready_featured.csv": [
    "year", "bib", "finish_type", "overall_rank", "leg", "split_key", "station_name",
    "split_rank", "split_distance_km", "race_distance_km", "segment_speed_kmh", "segment_time_s",
    "cum_time_seconds", "temperature_2m", "wind_direction_10m", "wind_effect", "weather_emoji",
  ],
  "xgb_black_probs_dashboard.csv": [
    "year", "bib", "finish_type", "split_key", "leg", "race_distance_km", "cum_time_seconds",
    "segment_speed_kmh", "split_rank", "split_rank_relative", "y_true", "p_black", "y_pred",
    "is_error", "error_type", "set", "model",
  ],
  "course_profile.csv": null, // copied as is
};

const COPY_FILES = [
  "gpx-overview/norseman_swim.gpx",
  "gpx-overview/norseman_bike.gpx",
  "gpx-overview/norseman_run.gpx",
  "logos/black-shirt_icon.jpg",
];

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });

for (const [file, columns] of Object.entries(CSV_FILES)) {
  const source = path.join(SOURCE, file);
  const target = path.join(TARGET, file);
  if (!columns) {
    copyFileSync(source, target);
    continue;
  }
  const parsed = Papa.parse(readFileSync(source, "utf8"), { header: true, skipEmptyLines: true });
  const missing = columns.filter((column) => !parsed.meta.fields.includes(column));
  if (missing.length > 0) {
    throw new Error(`${file}: missing columns ${missing.join(", ")}`);
  }
  const rows = parsed.data.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
  writeFileSync(target, Papa.unparse(rows, { columns }));
  const before = readFileSync(source).length / 1e6;
  const after = readFileSync(target).length / 1e6;
  console.log(`${file}: ${before.toFixed(1)} MB → ${after.toFixed(1)} MB`);
}

for (const file of COPY_FILES) {
  mkdirSync(path.dirname(path.join(TARGET, file)), { recursive: true });
  copyFileSync(path.join(SOURCE, file), path.join(TARGET, file));
}

console.log(`Public data ready in ${path.relative(process.cwd(), TARGET)}/`);
