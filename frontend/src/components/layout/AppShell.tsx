import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

import { FilterToolbar } from "@/components/layout/FilterToolbar";

const navigation = [
  { label: "Overview", to: "/overview" },
  { label: "Pacing & Course", to: "/pacing-course" },
  { label: "Model Predictions", to: "/model-predictions" },
  { label: "Tools", to: "/tools" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__brand">
            <h1>Norseman Black Shirt Prediction</h1>
          </div>

          <nav className="app-topbar__nav" aria-label="Primary">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "app-topbar__link app-topbar__link--active" : "app-topbar__link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <FilterToolbar />
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
