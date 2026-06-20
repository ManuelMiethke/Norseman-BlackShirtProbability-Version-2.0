import { RACE_YEAR_REGISTRY } from "@/config/raceRegistry";
import type { WideRow } from "@/types/data";

const FLAG_MAP: Record<string, string> = {
  NOR: "🇳🇴",
  NO: "🇳🇴",
  GBR: "🇬🇧",
  GB: "🇬🇧",
  UNK: "🏳️",
  UK: "🇬🇧",
  FRA: "🇫🇷",
  FR: "🇫🇷",
  USA: "🇺🇸",
  US: "🇺🇸",
  SWE: "🇸🇪",
  GER: "🇩🇪",
  DE: "🇩🇪",
  ITA: "🇮🇹",
  NED: "🇳🇱",
  NLD: "🇳🇱",
  CAN: "🇨🇦",
  POL: "🇵🇱",
  PL: "🇵🇱",
  SUI: "🇨🇭",
  FIN: "🇫🇮",
  EST: "🇪🇪",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
};

const COUNTRY_NORMALIZE: Record<string, string> = {
  POL: "PL",
  DEU: "DE",
  GER: "DE",
  GBR: "GB",
  UK: "GB",
  ENG: "GB",
  USA: "US",
  NOR: "NO",
};

export type ParticipantStats = {
  totalParticipants: number;
  participatingCountries: number;
  finishCounts: {
    black: number;
    white: number;
    dnf: number;
  };
  finishPercentages: {
    black: number;
    white: number;
    dnf: number;
  };
  genderCounts: {
    men: number;
    women: number;
  };
  genderPercentages: {
    men: number;
    women: number;
  };
  topCountries: Array<{
    code: string;
    flag: string;
    count: number;
    percentage: number;
  }>;
  restPercentage: number;
};

function normalizeCountry(code: string | null | undefined): string {
  if (!code) {
    return "UNK";
  }
  const normalized = String(code).trim().toUpperCase();
  return COUNTRY_NORMALIZE[normalized] ?? normalized;
}

function flagForCountry(code: string) {
  return FLAG_MAP[code] ?? "🏳️";
}

function dedupeParticipants(rows: WideRow[]) {
  const seen = new Set<string>();
  const unique: WideRow[] = [];

  for (const row of rows) {
    const key = `${row.year}-${row.bib}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

function statsForSingleYear(rows: WideRow[], year: number): ParticipantStats | null {
  const subset = rows.filter((row) => row.year === year);
  if (subset.length === 0) {
    return null;
  }

  const starters = RACE_YEAR_REGISTRY[year]?.startersAfterSwim ?? subset.length;
  const black = subset.filter((row) => row.finish_type === "Black").length;
  const white = subset.filter((row) => row.finish_type === "White").length;
  const dnfKnown = subset.filter((row) => row.finish_type === "DNF").length;
  const dnf = year === 2019 || year === 2025 ? dnfKnown : Math.max(starters - black - white, 0);

  const men = subset.filter((row) => row.gender === "M").length;
  const women = subset.filter((row) => row.gender === "F").length;
  const genderBase = men + women || 1;

  const countryCounts = new Map<string, number>();
  for (const row of subset) {
    const country = normalizeCountry(row.country);
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  const totalCountryCount = [...countryCounts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const participatingCountries = [...countryCounts.keys()].filter((code) => code !== "UNK").length;
  const topCountries = [...countryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([code, count]) => ({
      code,
      flag: flagForCountry(code),
      count,
      percentage: (count / totalCountryCount) * 100,
    }));

  const restPercentage = Math.max(
    0,
    100 - topCountries.reduce((sum, country) => sum + country.percentage, 0),
  );

  return {
    totalParticipants: starters,
    participatingCountries,
    finishCounts: { black, white, dnf },
    finishPercentages: {
      black: (black / starters) * 100,
      white: (white / starters) * 100,
      dnf: (dnf / starters) * 100,
    },
    genderCounts: { men, women },
    genderPercentages: {
      men: (men / genderBase) * 100,
      women: (women / genderBase) * 100,
    },
    topCountries,
    restPercentage,
  };
}

export function computeParticipantStats(rows: WideRow[], selectedYear: number | "All"): ParticipantStats | null {
  const participants = dedupeParticipants(rows);

  if (selectedYear !== "All") {
    return statsForSingleYear(participants, selectedYear);
  }

  const years = [...new Set(participants.map((row) => row.year))].sort((left, right) => left - right);
  const perYear = years
    .map((year) => statsForSingleYear(participants, year))
    .filter((value): value is ParticipantStats => value !== null);

  if (perYear.length === 0) {
    return null;
  }

  const countryCounts = new Map<string, number>();
  for (const row of participants) {
    const country = normalizeCountry(row.country);
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  const totalCountryCount = [...countryCounts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const participatingCountries = [...countryCounts.keys()].filter((code) => code !== "UNK").length;
  const topCountries = [...countryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([code, count]) => ({
      code,
      flag: flagForCountry(code),
      count,
      percentage: (count / totalCountryCount) * 100,
    }));

  const restPercentage = Math.max(
    0,
    100 - topCountries.reduce((sum, country) => sum + country.percentage, 0),
  );

  const totalParticipants = perYear.reduce((sum, item) => sum + item.totalParticipants, 0);
  const black = perYear.reduce((sum, item) => sum + item.finishCounts.black, 0);
  const white = perYear.reduce((sum, item) => sum + item.finishCounts.white, 0);
  const dnf = perYear.reduce((sum, item) => sum + item.finishCounts.dnf, 0);
  const men = perYear.reduce((sum, item) => sum + item.genderCounts.men, 0);
  const women = perYear.reduce((sum, item) => sum + item.genderCounts.women, 0);
  const genderBase = men + women || 1;

  return {
    totalParticipants,
    participatingCountries,
    finishCounts: { black, white, dnf },
    finishPercentages: {
      black: (black / totalParticipants) * 100,
      white: (white / totalParticipants) * 100,
      dnf: (dnf / totalParticipants) * 100,
    },
    genderCounts: { men, women },
    genderPercentages: {
      men: (men / genderBase) * 100,
      women: (women / genderBase) * 100,
    },
    topCountries,
    restPercentage,
  };
}
