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
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__eyebrow">React Migration</div>
          <h1>Norseman Performance Dashboard</h1>
          <p>
            A React-first frontend that keeps the existing race analytics and Plotly chart language while moving away from Streamlit.
          </p>
        </div>

        <nav className="app-sidebar__nav" aria-label="Primary">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "app-sidebar__link app-sidebar__link--active" : "app-sidebar__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <img
            src="/logos/black-shirt_icon.jpg"
            alt="Black shirt icon"
            width={88}
            height={88}
          />
          <span>Shared race assets are served directly from the existing dashboard package.</span>
        </div>
      </aside>

      <div className="app-main">
        <FilterToolbar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
