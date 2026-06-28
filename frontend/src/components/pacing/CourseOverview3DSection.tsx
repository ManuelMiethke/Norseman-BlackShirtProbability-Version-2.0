import { useEffect, useState } from "react";

import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";

const GPX_OVERVIEW_BODY = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Norseman 3D Overview</title>
    <style>__STYLES__</style>
  </head>
  <body class="embed-body">
    <main class="page-shell">
      <section class="hero" hidden aria-hidden="true">
        <div class="hero-copy">
          <p class="eyebrow" id="event-eyebrow">Norseman Visualization</p>
          <h1 id="event-title">Route as a 3D Elevation Model</h1>
          <p class="intro" id="event-intro"></p>
        </div>
        <div class="switch-stack">
          <div class="event-switch" id="event-switch" aria-label="Select event"></div>
          <div class="route-switch" id="route-switch" aria-label="Select route"></div>
        </div>
      </section>

      <section class="visual-card">
        <div class="canvas-wrap">
          <div class="canvas-stage">
            <canvas id="route-canvas" aria-label="3D overview of the Norseman route"></canvas>
            <div class="canvas-caption">
              <span id="route-title">Loading route...</span>
              <span id="route-subtitle"></span>
            </div>
          </div>

          <div class="profile-wrap profile-wrap-inline">
            <div class="profile-label-row">
              <span>Elevation Profile</span>
              <span id="elevation-range">--</span>
            </div>
            <div class="profile-legend" id="profile-legend"></div>
            <svg id="elevation-profile" viewBox="0 0 1000 180" preserveAspectRatio="none"></svg>
            <div class="profile-hover" id="profile-hover" hidden></div>
          </div>
        </div>

        <section class="stats-panel">
          <div class="primary-stat">
            <span class="stat-label" id="primary-stat-label">Elevation Gain</span>
            <strong id="ascent-value">--</strong>
          </div>

          <div class="stat-grid">
            <article class="stat-card">
              <span class="stat-label" id="distance-label">Distance</span>
              <strong id="distance-value">--</strong>
            </article>
            <article class="stat-card">
              <span class="stat-label" id="descent-label">Descent</span>
              <strong id="descent-value">--</strong>
            </article>
            <article class="stat-card">
              <span class="stat-label" id="max-ele-label">Highest Point</span>
              <strong id="max-ele-value">--</strong>
            </article>
          </div>
        </section>
      </section>

      <div class="message" id="message" hidden></div>
    </main>

    <script>__SCRIPT__</script>
  </body>
</html>`;

export function CourseOverview3DSection() {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/gpx-overview/styles.css").then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load embedded GPX stylesheet.");
        }
        return response.text();
      }),
      fetch("/gpx-overview/app.js").then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load embedded GPX script.");
        }
        return response.text();
      }),
    ])
      .then(([styles, script]) => {
        if (cancelled) {
          return;
        }

        const escapedScript = script.replace(/<\/script/gi, "<\\/script");
        setSrcDoc(
          GPX_OVERVIEW_BODY
            .replace("__STYLES__", styles)
            .replace("__SCRIPT__", escapedScript),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "The embedded GPX overview could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard title="3D Course Overview" className="pacing-card pacing-card--course-overview">
      <div className="section-stack">
        <div className="section-note">
          <strong>Overall view</strong>
          <span>Combined Norseman swim, bike, and run GPX route. Drag to rotate, scroll to zoom, double-click to reset.</span>
        </div>

        {loadError ? (
          <StateBlock
            title="3D view unavailable"
            description={loadError}
            tone="warning"
          />
        ) : srcDoc ? (
          <iframe
            title="Norseman 3D course overview"
            srcDoc={srcDoc}
            className="course-overview-frame"
            loading="lazy"
          />
        ) : (
          <StateBlock
            title="Loading"
            description="Preparing the 3D GPX overview."
          />
        )}
      </div>
    </SectionCard>
  );
}
