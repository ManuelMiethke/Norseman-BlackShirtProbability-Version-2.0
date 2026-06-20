import { useEffect, useState } from "react";

import { loadLongCsv } from "@/lib/csv";
import type { LongRow } from "@/types/data";

type LongDataState = {
  rows: LongRow[];
  isLoading: boolean;
  error: string | null;
};

function toLongRow(record: Record<string, unknown>): LongRow {
  return {
    year: Number(record.year),
    bib: Number(record.bib),
    name: String(record.name ?? ""),
    finish_type: String(record.finish_type ?? ""),
    overall_rank:
      record.overall_rank === undefined || record.overall_rank === null || record.overall_rank === ""
        ? undefined
        : Number(record.overall_rank),
    split_key: String(record.split_key ?? ""),
    split_rank:
      record.split_rank === undefined || record.split_rank === null || record.split_rank === ""
        ? undefined
        : Number(record.split_rank),
    race_distance_km:
      record.race_distance_km === undefined ||
      record.race_distance_km === null ||
      record.race_distance_km === ""
        ? undefined
        : Number(record.race_distance_km),
    cum_time_seconds:
      record.cum_time_seconds === undefined ||
      record.cum_time_seconds === null ||
      record.cum_time_seconds === ""
        ? undefined
        : Number(record.cum_time_seconds),
  };
}

export function useLongData(): LongDataState {
  const [state, setState] = useState<LongDataState>({
    rows: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loadLongCsv()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        const rows = records
          .map(toLongRow)
          .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.bib) && row.split_key.length > 0);

        setState({
          rows,
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
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load split data.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
