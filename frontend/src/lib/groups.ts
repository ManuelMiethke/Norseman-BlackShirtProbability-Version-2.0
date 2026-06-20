import type { GroupOption } from "@/config/raceRegistry";
import type { WideRow } from "@/types/data";

type YearOption = number | "All";

function normalizeRank(value: unknown): number | null {
  const rank = typeof value === "number" ? value : Number(value ?? Number.NaN);
  return Number.isFinite(rank) ? rank : null;
}

export function normalizeFinishType(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isBlackFinishType(value: unknown): boolean {
  return normalizeFinishType(value).includes("black");
}

export function isWhiteFinishType(value: unknown): boolean {
  return normalizeFinishType(value).includes("white");
}

export function isDnfFinishType(value: unknown): boolean {
  return normalizeFinishType(value).includes("dnf");
}

export function isCompleteFinisher(row: Pick<WideRow, "finish_type">): boolean {
  return isBlackFinishType(row.finish_type) || isWhiteFinishType(row.finish_type);
}

export function filterRowsByYear(rows: WideRow[], selectedYear: YearOption): WideRow[] {
  if (selectedYear === "All") {
    return rows;
  }

  return rows.filter((row) => Number(row.year) === selectedYear);
}

export function matchesGroup(row: WideRow, group: GroupOption): boolean {
  if (group === "All") {
    return true;
  }

  if (group === "DNF") {
    return isDnfFinishType(row.finish_type);
  }

  if (group === "Black Shirt") {
    return isBlackFinishType(row.finish_type);
  }

  if (group === "White Shirt") {
    return isWhiteFinishType(row.finish_type);
  }

  if (group === "Top 10") {
    const rank = normalizeRank(row.overall_rank);
    return rank !== null && rank <= 10;
  }

  return true;
}

export function filterRowsByGroup(rows: WideRow[], group: GroupOption): WideRow[] {
  return rows.filter((row) => matchesGroup(row, group));
}
