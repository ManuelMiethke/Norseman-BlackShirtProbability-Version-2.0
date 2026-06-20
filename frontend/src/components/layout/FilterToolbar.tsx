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
    <header className="filter-toolbar">
      <div className="filter-toolbar__copy">
        <div className="filter-toolbar__eyebrow">Fresh Frontend, Same Race Logic</div>
        <h2>React shell with preserved Plotly analytics</h2>
        <p>
          The migration starts with the overview route and keeps the current race semantics, filters and chart behavior stable while the frontend moves to React.
        </p>
      </div>

      <div className="filter-toolbar__controls">
        <label className="filter-card">
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

        <label className="filter-card">
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
    </header>
  );
}
