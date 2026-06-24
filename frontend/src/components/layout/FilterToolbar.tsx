import { useDashboard } from "@/state/DashboardContext";

export function FilterToolbar() {
  const {
    years,
    selectedYear,
    selectedGroup,
    setSelectedYear,
    setSelectedGroup,
    groupOptions,
    isLoading,
  } = useDashboard();

  return (
    <div className="topbar-controls">
      <label className="topbar-filter">
        <span>Year</span>
        <select
          disabled={isLoading}
          value={String(selectedYear)}
          onChange={(event) =>
            setSelectedYear(event.target.value === "All" ? "All" : Number(event.target.value))
          }
        >
          {years.map((year: number | "All") => (
            <option key={String(year)} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="topbar-filter">
        <span>Group</span>
        <select
          disabled={isLoading}
          value={selectedGroup}
          onChange={(event) => setSelectedGroup(event.target.value as typeof selectedGroup)}
        >
          {groupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
