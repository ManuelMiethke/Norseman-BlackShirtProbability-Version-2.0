export function anonymizeAthleteName(bib: number | null | undefined, year?: number | null): string {
  const bibValue = Number(bib);
  const yearValue = Number(year);

  if (Number.isFinite(yearValue) && Number.isFinite(bibValue)) {
    return `Athlete ${yearValue}-${String(bibValue).padStart(3, "0")}`;
  }

  if (Number.isFinite(bibValue)) {
    return `Athlete ${String(bibValue).padStart(3, "0")}`;
  }

  return "Athlete";
}
