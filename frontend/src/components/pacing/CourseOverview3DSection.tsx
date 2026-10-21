import { useEffect, useMemo, useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import type { ChartLegendItem } from "@/components/common/ChartLegend";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { COURSE_OVERVIEW_3D_INFO } from "@/content/chartInfo";
import { assetUrl } from "@/lib/assets";
import {
  buildCourseOverviewModel,
  cameraScaleFor,
  COURSE_SLOPE_CLASSES,
  parseGpx,
  type CourseLeg,
} from "@/lib/courseOverview3d";

const GPX_FILES: Array<{ leg: CourseLeg; file: string }> = [
  { leg: "Swim", file: "/gpx-overview/norseman_swim.gpx" },
  { leg: "Bike", file: "/gpx-overview/norseman_bike.gpx" },
  { leg: "Run", file: "/gpx-overview/norseman_run.gpx" },
];

const SLOPE_LEGEND: ChartLegendItem[] = COURSE_SLOPE_CLASSES.map((entry) => ({
  label: entry.label,
  color: entry.color,
}));

type GpxState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; legs: ReturnType<typeof parseGpx>[] };

function useCourseGpx(): GpxState {
  const [state, setState] = useState<GpxState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      GPX_FILES.map(async ({ leg, file }) => {
        const response = await fetch(assetUrl(file));
        if (!response.ok) {
          throw new Error(`Could not load ${file} (${response.status}).`);
        }
        return parseGpx(await response.text(), leg);
      }),
    )
      .then((legs) => {
        if (!cancelled) setState({ status: "ready", legs });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not load the GPX tracks.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Approximate chart sizes (card + fullscreen) from the window, mirroring global.css. */
function useViewport() {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(read()));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return viewport;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function CourseOverview3DSection() {
  const gpx = useCourseGpx();
  const model = useMemo(
    () => (gpx.status === "ready" ? buildCourseOverviewModel(gpx.legs) : null),
    [gpx],
  );
  const viewport = useViewport();
  // Card: full content width, height clamp(460px, 62vh, 620px) – see .plot-card--course.
  const cardScale = cameraScaleFor(
    viewport.width - 60,
    Math.min(Math.max(viewport.height * 0.62, 460), 620),
  );
  // Fullscreen panel: min(1400px, 100vw - 4rem) × min(84vh, 900px) minus header/padding.
  const modalScale = cameraScaleFor(
    Math.min(1400, viewport.width - 64) - 32,
    Math.min(viewport.height * 0.84, 900) - 80,
  );
  const layout = useMemo(() => model?.figure.layoutFor(cardScale), [model, cardScale]);
  const expandedLayout = useMemo(() => model?.figure.layoutFor(modalScale), [model, modalScale]);
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="3D Course Overview" info={COURSE_OVERVIEW_3D_INFO} />
    </div>
  );

  return (
    <SectionCard
      title="3D Course Overview"
      className="pacing-card pacing-card--course-overview"
      headerActions={headerActions}
    >
      {gpx.status === "loading" ? (
        <StateBlock title="Loading" description="Reading the swim, bike and run GPX tracks." />
      ) : gpx.status === "error" ? (
        <StateBlock title="Load failed" description={gpx.message} tone="error" />
      ) : model && layout ? (
        <PlotlyChart
          data={model.figure.data}
          layout={layout}
          expandedLayout={expandedLayout}
          className="plot-card--course"
          title="Course, elevation and climbs"
          legend={SLOPE_LEGEND}
          interactive
          headerExtra={
            <>
              <strong>{model.stats.distanceKm.toFixed(1)} km</strong> ·{" "}
              ↑ <strong>{formatNumber(model.stats.ascentM)} m</strong> ·{" "}
              ↓ <strong>{formatNumber(model.stats.descentM)} m</strong> · max{" "}
              <strong>{formatNumber(model.stats.maxEleM)} m</strong>
            </>
          }
        />
      ) : (
        <StateBlock title="No data" description="The GPX tracks contain no points." tone="warning" />
      )}
    </SectionCard>
  );
}
