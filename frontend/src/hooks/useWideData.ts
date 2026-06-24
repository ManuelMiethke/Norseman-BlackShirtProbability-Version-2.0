import { KNOWN_YEARS } from "@/config/raceRegistry";
import { useCsvRows, type CsvRowsState } from "@/hooks/useCsvRows";
import { loadWideCsv } from "@/lib/csv";
import { anonymizeAthleteName } from "@/lib/privacy";
import type { WideRow } from "@/types/data";

type WideDataState = CsvRowsState<WideRow> & {
  rows: WideRow[];
  years: Array<number | "All">;
};

function toWideRow(record: Record<string, unknown>): WideRow {
  return {
    year: Number(record.year),
    bib: Number(record.bib),
    name: anonymizeAthleteName(Number(record.bib), Number(record.year)),
    gender: String(record.gender ?? ""),
    country: String(record.country ?? ""),
    finish_type: String(record.finish_type ?? ""),
    club: record.club ? String(record.club) : undefined,
    overall_rank:
      record.overall_rank === undefined || record.overall_rank === null || record.overall_rank === ""
        ? undefined
        : Number(record.overall_rank),
    overall_time: record.overall_time ? String(record.overall_time) : undefined,
    swim_time: record.swim_time ? String(record.swim_time) : undefined,
    t1_time: record.t1_time ? String(record.t1_time) : undefined,
    bike_time: record.bike_time ? String(record.bike_time) : undefined,
    t2_time: record.t2_time ? String(record.t2_time) : undefined,
    run_time: record.run_time ? String(record.run_time) : undefined,
    zombie_hill_time: record.zombie_hill_time ? String(record.zombie_hill_time) : undefined,
    run_start_time: record.run_start_time ? String(record.run_start_time) : undefined,
    run_32_5km_langefonn_time: record.run_32_5km_langefonn_time
      ? String(record.run_32_5km_langefonn_time)
      : undefined,
    run_37_5km_stavsro_cut_off_time: record.run_37_5km_stavsro_cut_off_time
      ? String(record.run_37_5km_stavsro_cut_off_time)
      : undefined,
  };
}

function isValidWideRow(row: WideRow) {
  return Number.isFinite(row.year) && Number.isFinite(row.bib);
}

export function useWideData(): WideDataState {
  const state = useCsvRows({
    loader: loadWideCsv,
    mapRow: toWideRow,
    filter: isValidWideRow,
    errorMessage: "Failed to load race data.",
  });

  const dynamicYears =
    state.rows.length > 0
      ? [...new Set<number>(state.rows.map((row) => row.year))].sort((left, right) => right - left)
      : KNOWN_YEARS;

  return {
    ...state,
    years: ["All", ...dynamicYears],
  };
}
