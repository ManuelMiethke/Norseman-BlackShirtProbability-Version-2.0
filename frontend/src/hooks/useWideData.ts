import { useEffect, useState } from "react";

import { KNOWN_YEARS } from "@/config/raceRegistry";
import { loadWideCsv } from "@/lib/csv";
import type { WideRow } from "@/types/data";

type WideDataState = {
  rows: WideRow[];
  years: Array<number | "All">;
  isLoading: boolean;
  error: string | null;
};

function toWideRow(record: Record<string, unknown>): WideRow {
  return {
    year: Number(record.year),
    bib: Number(record.bib),
    name: String(record.name ?? ""),
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
    bike_time: record.bike_time ? String(record.bike_time) : undefined,
    run_time: record.run_time ? String(record.run_time) : undefined,
  };
}

export function useWideData(): WideDataState {
  const [state, setState] = useState<WideDataState>({
    rows: [],
    years: ["All", ...KNOWN_YEARS],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loadWideCsv()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        const rows = records
          .map(toWideRow)
          .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.bib));
        const dynamicYears = [...new Set<number>(rows.map((row) => row.year))].sort(
          (left: number, right: number) => right - left,
        );
        setState({
          rows,
          years: ["All", ...dynamicYears],
          isLoading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setState({
          rows: [],
          years: ["All", ...KNOWN_YEARS],
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load race data.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
