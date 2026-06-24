import { useEffect, useState } from "react";

type CsvRecord = Record<string, unknown>;

export type CsvRowsState<T> = {
  rows: T[];
  isLoading: boolean;
  error: string | null;
};

type UseCsvRowsOptions<T> = {
  loader: () => Promise<CsvRecord[]>;
  mapRow: (record: CsvRecord) => T;
  filter?: (row: T) => boolean;
  sort?: (left: T, right: T) => number;
  errorMessage: string;
};

export function useCsvRows<T>({
  loader,
  mapRow,
  filter,
  sort,
  errorMessage,
}: UseCsvRowsOptions<T>): CsvRowsState<T> {
  const [state, setState] = useState<CsvRowsState<T>>({
    rows: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loader()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        let rows = records.map(mapRow);
        if (filter) {
          rows = rows.filter(filter);
        }
        if (sort) {
          rows = rows.slice().sort(sort);
        }

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
          error: error instanceof Error ? error.message : errorMessage,
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [errorMessage, filter, loader, mapRow, sort]);

  return state;
}
