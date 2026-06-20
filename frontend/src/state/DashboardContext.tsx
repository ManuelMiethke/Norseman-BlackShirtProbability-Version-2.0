import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  GROUP_OPTIONS,
  type GroupOption,
} from "@/config/raceRegistry";
import { useWideData } from "@/hooks/useWideData";
import type { WideRow } from "@/types/data";

type YearOption = number | "All";

type DashboardContextValue = {
  rows: WideRow[];
  years: YearOption[];
  selectedYear: YearOption;
  selectedGroup: GroupOption;
  isLoading: boolean;
  error: string | null;
  setSelectedYear: (year: YearOption) => void;
  setSelectedGroup: (group: GroupOption) => void;
  groupOptions: GroupOption[];
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { rows, years, isLoading, error } = useWideData();
  const [selectedYear, setSelectedYear] = useState<YearOption>("All");
  const [selectedGroup, setSelectedGroup] = useState<GroupOption>("All");

  useEffect(() => {
    if (selectedYear !== "All" && !years.includes(selectedYear)) {
      setSelectedYear("All");
    }
  }, [selectedYear, years]);

  return (
    <DashboardContext.Provider
      value={{
        rows,
        years,
        selectedYear,
        selectedGroup,
        isLoading,
        error,
        setSelectedYear,
        setSelectedGroup,
        groupOptions: GROUP_OPTIONS,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider.");
  }
  return context;
}
