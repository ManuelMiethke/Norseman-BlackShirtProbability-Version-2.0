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
            <img
              className="app-topbar__logo"
              src="/logos/black-shirt_icon.jpg"
              alt=""
              width={32}
              height={32}
            />
            <h1>
              <span className="app-topbar__title">Norseman</span>
              <span className="app-topbar__subtitle">Black Shirt Prediction</span>
            </h1>
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
