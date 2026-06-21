import { useEffect, useState } from "react";

import { loadModelCsv } from "@/lib/csv";
import type { ModelRow } from "@/types/data";

type ModelDataState = {
  rows: ModelRow[];
  isLoading: boolean;
  error: string | null;
};

function toModelRow(record: Record<string, unknown>): ModelRow {
  return {
    year: Number(record.year),
    bib: Number(record.bib),
    name: String(record.name ?? ""),
    finish_type: String(record.finish_type ?? ""),
    split_key: String(record.split_key ?? ""),
    leg: String(record.leg ?? ""),
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
    segment_speed_kmh:
      record.segment_speed_kmh === undefined ||
      record.segment_speed_kmh === null ||
      record.segment_speed_kmh === ""
        ? undefined
        : Number(record.segment_speed_kmh),
    split_rank:
      record.split_rank === undefined ||
      record.split_rank === null ||
      record.split_rank === ""
        ? undefined
        : Number(record.split_rank),
    split_rank_relative:
      record.split_rank_relative === undefined ||
      record.split_rank_relative === null ||
      record.split_rank_relative === ""
        ? undefined
        : Number(record.split_rank_relative),
    y_true:
      record.y_true === undefined || record.y_true === null || record.y_true === ""
        ? undefined
        : Number(record.y_true),
    p_black:
      record.p_black === undefined || record.p_black === null || record.p_black === ""
        ? undefined
        : Number(record.p_black),
    y_pred:
      record.y_pred === undefined || record.y_pred === null || record.y_pred === ""
        ? undefined
        : Number(record.y_pred),
    is_error:
      record.is_error === undefined || record.is_error === null || record.is_error === ""
        ? undefined
        : Number(record.is_error),
    error_type: record.error_type ? String(record.error_type) : undefined,
    set: record.set ? String(record.set) : undefined,
  };
}

export function useModelData(): ModelDataState {
  const [state, setState] = useState<ModelDataState>({
    rows: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loadModelCsv()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        const rows = records
          .map(toModelRow)
          .filter(
            (row) =>
              Number.isFinite(row.year) &&
              Number.isFinite(row.bib) &&
              row.split_key.length > 0 &&
              Number.isFinite(row.race_distance_km ?? Number.NaN),
          );

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
          error: error instanceof Error ? error.message : "Failed to load model data.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
