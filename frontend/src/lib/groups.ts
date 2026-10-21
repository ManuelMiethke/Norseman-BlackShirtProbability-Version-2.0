import { RANK_BAND, RANK_BAND_GROUP, type GroupOption } from "@/config/raceRegistry";

type YearOption = number | "All";
type FinishLike = { finish_type: unknown };
type RankLike = { overall_rank?: unknown };
type YearLike = { year: unknown };
type AthleteLike = { year: unknown; bib: unknown };

export type ExclusiveGroup = Exclude<GroupOption, "All" | typeof RANK_BAND_GROUP> | "Other";

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

export function isTop10Rank(value: unknown): boolean {
  const rank = normalizeRank(value);
  return rank !== null && rank <= 10;
}

/** True when a rank lies inside the configurable comparison band (e.g. 140–180). */
export function isInRankBand(value: unknown): boolean {
  const rank = normalizeRank(value);
  return rank !== null && rank >= RANK_BAND.min && rank <= RANK_BAND.max;
}

export function isCompleteFinisher(row: FinishLike): boolean {
  return isBlackFinishType(row.finish_type) || isWhiteFinishType(row.finish_type);
}

export function athleteKey<T extends AthleteLike>(row: T, includeYear = true): string {
  const bib = Number(row.bib);
  const year = Number(row.year);
  return includeYear ? `${year}:${bib}` : String(bib);
}

export function filterRowsByYear<T extends YearLike>(rows: T[], selectedYear: YearOption): T[] {
  if (selectedYear === "All") {
    return rows;
  }

  return rows.filter((row) => Number(row.year) === selectedYear);
}

export function classifyFinishGroup(
  row: FinishLike & RankLike,
  options?: { dnfBeforeTop10?: boolean },
): ExclusiveGroup {
  const dnfBeforeTop10 = options?.dnfBeforeTop10 ?? false;

  if (dnfBeforeTop10 && isDnfFinishType(row.finish_type)) {
    return "DNF";
  }

  if (isTop10Rank(row.overall_rank)) {
    return "Top 10";
  }

  if (isDnfFinishType(row.finish_type)) {
    return "DNF";
  }

  if (isBlackFinishType(row.finish_type)) {
    return "Black Shirt";
  }

  if (isWhiteFinishType(row.finish_type)) {
    return "White Shirt";
  }

  return "Other";
}

export function matchesGroup<T extends FinishLike & RankLike>(row: T, group: GroupOption): boolean {
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
    return isTop10Rank(row.overall_rank);
  }

  if (group === RANK_BAND_GROUP) {
    return isInRankBand(row.overall_rank);
  }

  return true;
}

export function filterRowsByGroup<T extends FinishLike & RankLike>(rows: T[], group: GroupOption): T[] {
  return rows.filter((row) => matchesGroup(row, group));
}
