export type ChartInfoSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type ChartInfoSpec = {
  sections: ChartInfoSection[];
};

export const PARTICIPATION_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This card summarizes participation volume, gender split and finish outcomes for the currently selected year filter.",
        "The top counters show total participants and represented countries.",
        "The lower bars show how the field splits across gender and final race outcomes.",
      ],
    },
    {
      heading: "2025 demand",
      bullets: [
        "For 2025, over 6,300 applicants from roughly 96 countries entered the Norseman lottery for about 250 race slots.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Wider bar segments mean a larger share of the field.",
        "The counts below each bar are centered on the midpoint of their segment so the text lines up with the actual share.",
        "Outcome shares let you compare how large the Black, White and DNF groups are in the selected year.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It gives a quick field-size snapshot before diving into the detailed charts.",
        "It helps frame the rest of the dashboard with the actual athlete mix behind the analyses.",
      ],
    },
  ],
};

export const TIME_RELATIONS_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The first donut shows how total Norseman distance is split across swim, bike and run.",
        "The companion donuts show the median time share spent in each leg for Top 10, Black Shirt and White Shirt athletes.",
        "Delta mode compares each group against the Black Shirt median to show where time share moves up or down.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "If a leg takes a bigger share of time than distance, it is especially performance-critical.",
        "Differences between groups show where stronger athletes spend relatively less or more race time.",
        "Large delta swings highlight segments where pacing patterns separate most clearly.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows which leg matters most for total performance.",
        "It helps benchmark a selected finisher group against the Black Shirt reference.",
      ],
    },
  ],
};

export const YEAR_COMPARISON_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The left chart compares median swim, bike and run times by year up to 32.5 km on the run.",
        "The right chart shows the overall median finish time by year for the same selected group.",
        "The mode switch changes the left comparison chart between absolute overview and the latest-year baseline view.",
        "The Zoomed time differences toggle narrows the right chart to the observed finish-time range so small year-to-year shifts become easier to read.",
        "The global group filter keeps the comparison focused on the same athlete cohort across years.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Longer bars or higher values mean slower segment medians.",
        "Within-year comparison shows which discipline dominates race time in that edition.",
        "Baseline mode marks faster years against the latest-year benchmark and slower years against the same baseline.",
        "In the zoomed finish-time view, lower points indicate quicker race medians and higher points indicate slower editions.",
        "The finish-time chart lets you compare total race difficulty or pace shifts independently from the leg split structure.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It reveals how race editions shifted over time.",
        "It helps identify which leg drives yearly performance changes.",
      ],
    },
  ],
};

export const OUTCOME_MIX_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The stacked bars show how starters split into Black Shirt, White Shirt, DNF and the cut-off frontier miss group in each race year.",
        "The second chart summarizes the empirical 37.5 km run frontier across the 37.5 km cut-off years, where Black Shirt qualification pressure was determined by rank around 160.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "A larger Black Shirt share means more athletes finished above the decision frontier.",
        "A larger missed-at-frontier share points to stronger competition around the cut-off.",
        "A shorter frontier time means athletes needed a faster pace to stay Black-Shirt eligible.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It compares competitiveness and finish-outcome mix across years.",
        "It gives a realistic cut-off reference for the late run decision point.",
      ],
    },
  ],
};

type RankProgressionMode =
  | "Top 10 finishers"
  | "Places 140-180"
  | "All athletes to cut-off";

export function getRankProgressionInfo(
  mode: RankProgressionMode,
  focusTop10: boolean,
): ChartInfoSpec {
  if (mode === "Top 10 finishers") {
    return {
      sections: [
        {
          heading: "What is shown",
          bullets: focusTop10
            ? [
                "Colored lines follow the final Top 10 finishers only while they are holding Top 10 ranks.",
                "Grey lines mark athletes who temporarily entered the Top 10 but did not finish there.",
                "The x-axis is race distance and the y-axis is rank, where 1 is best.",
              ]
            : [
                "Each colored line follows one final Top 10 finisher across the full race.",
                "The x-axis is race distance and the y-axis is rank, where 1 is best.",
                "This broader view keeps the full tactical story instead of only the moments inside the Top 10 window.",
              ],
        },
        {
          heading: "How to interpret it",
          bullets: [
            "Lines moving upward indicate improving position, while downward moves mean lost places.",
            "Crossings highlight overtakes and unstable ranking phases.",
            "If the field stabilizes early, the lines separate and cross less often later in the race.",
          ],
        },
        {
          heading: "Why it is useful",
          bullets: [
            "It shows where decisive Top 10 moves happen on the course.",
            "It helps compare how tactical or stable the front of the race was in a selected year.",
          ],
        },
      ],
    };
  }

  if (mode === "Places 140-180") {
    return {
      sections: [
        {
          heading: "What is shown",
          bullets: [
            "This view isolates the race-position window from rank 140 to 180 across the course.",
            "Thicker lines represent athletes who finished inside that band.",
            "Thinner lines represent athletes who only passed through that band temporarily.",
          ],
        },
        {
          heading: "How to interpret it",
          bullets: [
            "Upward movement means rank gains, while downward movement means positions lost.",
            "Dense crossings signal unstable mid-pack battles around the decision frontier.",
            "The view is especially useful for spotting when athletes move into or out of the cut-off pressure zone.",
          ],
        },
        {
          heading: "Why it is useful",
          bullets: [
            "It shows where the mid-pack decision battle is most volatile.",
            "It helps compare how stable the 140-180 rank window was between years.",
          ],
        },
      ],
    };
  }

  return {
    sections: [
      {
        heading: "What is shown",
        bullets: [
          "This chart follows athlete rank over distance up to the Black/White decision cut-off.",
          "The selected group filter is applied in this mode, so you can isolate Top 10, Black Shirt, White Shirt or DNF athletes.",
          "The cut-off distance is year-specific and ends before the full finish line when that is how the decision rule worked.",
        ],
      },
      {
        heading: "How to interpret it",
        bullets: [
          "Lower ranks are better, so upward moves indicate overtakes and improvement.",
          "Wide line spread at the same distance means the field is separating strongly.",
          "Lines ending early or missing later sections usually reflect athletes who did not reach the same course point.",
        ],
      },
      {
        heading: "Why it is useful",
        bullets: [
          "It shows where ranking gaps open before the key cut-off point.",
          "It makes it easier to compare decision-window dynamics across finisher groups.",
        ],
      },
    ],
  };
}

export const HISTOGRAMS_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "These histograms show the distribution of swim, bike, run and finish times for the selected year and group filter.",
        "Absolute mode uses hh:mm:ss, Relative mode uses percentage against the segment median, and Bike-Time scale aligns all legs to a common visual axis.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "A distribution shifted left means faster athletes.",
        "A wider spread means more variability inside that group.",
        "Relative mode makes the size of swim, bike and run differences directly comparable.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It highlights which leg creates the biggest separation.",
        "It helps compare performance spread across Top 10, Black Shirt and White Shirt athletes.",
      ],
    },
  ],
};

export const COURSE_WEATHER_SPEED_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This chart combines course elevation, weather markers and median segment speed for the selected year.",
        "The filled background is elevation, while the stepped lines show group median speed between timing stations.",
        "Weather symbols add temperature, condition and wind-direction context along the course.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Higher speed segments mean the group moved faster in that course section.",
        "Sharp speed drops often align with climbs, technical terrain or fatigue later in the race.",
        "Wind markers help separate terrain effects from weather-driven slowdowns.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows where Top 10, Black Shirt and White Shirt athletes open gaps.",
        "It helps identify decisive sections where terrain and weather interact with pacing.",
      ],
    },
  ],
};

export const COURSE_OVERVIEW_3D_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This card stitches the Norseman swim, bike and run GPX tracks into one continuous 3D course view.",
        "The upper panel shows the spatial route, while the lower profile compresses the full climbing story into a single elevation strip.",
        "The summary cards underneath keep the main course facts visible: total distance, ascent, descent and highest point.",
      ],
    },
    {
      heading: "How to use it",
      bullets: [
        "The chart opens in a fixed overview angle first, so the full Norseman course is immediately readable.",
        "Click and drag inside the 3D route to unlock a controlled tilt view, then drag up or down to rotate the course vertically while Swim and Run stay fixed left and right.",
        "Use the mouse wheel to zoom and double-click to reset the preview.",
        "The profile below marks each meaningful climb segment with its length so the course rhythm stays readable at a glance.",
      ],
    },
    {
      heading: "The Course",
      paragraphs: [
        "Norseman starts in the black water of Eidfjord, stretches across the exposed roads of Hardangervidda and saves its final statement for the mountain wall toward Gaustatoppen.",
        "It is less a single route than a long escalation: cold fjord, wind-battered plateau and a brutal final climb where fatigue and altitude finally cash every earlier decision.",
      ],
    },
  ],
};

export const ACCUMULATED_PROGRESS_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "Each line represents one athlete's cumulative race time over accumulated course distance.",
        "Athletes are grouped by finish category so you can compare Top 10, Black Shirt, White Shirt and DNF trajectories.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Lower lines mean faster athletes at the same distance.",
        "Steeper sections indicate slower pace or tougher terrain.",
        "Lines that stop early represent athletes who did not continue to later checkpoints.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows where performance gaps open across finisher groups.",
        "It helps spot sections with high variability or frequent DNFs.",
      ],
    },
  ],
};

export const PACE_DISTRIBUTION_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "Each boxplot shows the distribution of leg times for Top 10, Black Shirt and White Shirt athletes.",
        "The optional Zombie Hill panel adds the late-run climb as an extra pacing segment.",
        "The details panel keeps the exact median, spread and extrema for each leg.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "A lower box or median line means faster typical performance.",
        "A taller box means more variability within the group.",
        "Large gaps between groups indicate legs where the race separates most clearly.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows where Top 10 and Black Shirt performances diverge from White Shirt athletes.",
        "It helps identify pacing-sensitive sections with unusually wide spread.",
      ],
    },
  ],
};

export const PACING_HEATMAP_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The heatmap compares each athlete's split time against the median at the same timing station.",
        "Columns represent athletes ordered by finish outcome, while rows follow the timing stations in race order.",
        "Warm colors mean faster-than-median pacing and cool colors mean slower-than-median pacing.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Stable color bands indicate a consistent pacing profile over many splits.",
        "Strong color changes across rows point to segment-specific strengths, fatigue or pacing shifts.",
        "Large blocks of similar color within a group show common pacing behavior.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It makes pacing consistency easy to compare across finisher groups.",
        "It helps spot where gaps emerge or unusual pacing patterns cluster.",
      ],
    },
  ],
};

export const MODEL_ACCURACY_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This chart shows model accuracy at each official timing station along the course.",
        "The amber line is classification accuracy, while the course profile underneath adds terrain context.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Rising accuracy means Black vs White outcomes become easier to predict as the race unfolds.",
        "Drops in accuracy often point to sections where athlete outcomes are still volatile or terrain is disruptive.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows where the model is most uncertain.",
        "It helps compare early-race versus late-race predictive stability.",
      ],
    },
  ],
};

export const BLACK_SHIRT_PROBABILITY_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The chart follows predicted Black Shirt probability over race distance.",
        "Thin lines represent individual athletes, while the highlighted summary traces show the median and mean path for the selected cohort.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Rising curves mean an athlete's Black Shirt chance improves.",
        "Falling curves mark sections where the athlete is losing decision-frontier safety.",
        "Sharp changes usually identify decisive parts of the course.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows where Black Shirt success becomes more or less likely.",
        "It helps compare how probability trajectories differ across finisher groups.",
      ],
    },
  ],
};

export const FRONTIER_PACE_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This section estimates the modeled 50% Black Shirt frontier across the course.",
        "The main chart shows the split-by-split frontier pace, the table lists its timing details, and the companion view compares athletes against that frontier.",
        "Absolute mode keeps accumulated race time, while Relative mode shows time gained or lost versus the modeled frontier.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "A lower frontier time means a faster pace is required to stay on the Black-Shirt border.",
        "Positive relative gaps mean an athlete is behind the frontier, while negative gaps mean the athlete is ahead of it.",
        "Sectors where the frontier steepens are the sections where the model sees the strongest pressure.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It turns model output into pacing targets that can be compared across splits.",
        "It helps explain where the race becomes difficult to stay Black-Shirt eligible.",
      ],
    },
  ],
};

export const PROBABILITY_SURFACE_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "The surface maps predicted Black Shirt probability over cumulative time and course distance.",
        "3D mode shows the full probability landscape, while 2D mode focuses on the transition band where probability moves most sharply.",
        "Optional bike or run checkpoints plus a race time place markers on the surface for quick lookups.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Higher regions or darker values mean a stronger Black Shirt chance.",
        "Steep gradients mark course zones where small time losses change the forecast quickly.",
        "A marker sitting near the 50% band means the athlete is close to the decision frontier.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It shows when the race outcome becomes predictable.",
        "It helps translate a current distance and time into a model-based probability estimate.",
      ],
    },
  ],
};

export const CATCHUP_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This tool estimates Black Shirt probability and the pace still required to reach Stavsro on time.",
        "Inputs describe the athlete's current bike or run position and elapsed race time.",
        "Outputs combine model probability, historical neighbor probability, required bike pace and required run pace.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "Model probability is the prediction-model view, while Similar athletes shows the local historical share around the same race state.",
        "Required pace values become theoretical once they move far beyond typical Black Shirt performances.",
        "The tool only makes sense after the swim and before the Stavsro cut-off.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It gives a live-like estimate of how realistic Black Shirt qualification still is.",
        "It converts the current race state into actionable pacing targets.",
      ],
    },
  ],
};

export const EMPIRICAL_PACE_INFO: ChartInfoSpec = {
  sections: [
    {
      heading: "What is shown",
      bullets: [
        "This planner builds a Black Shirt pacing blueprint for a 13:51 finish target.",
        "The overview table and detailed chart scale historical Black Shirt pacing patterns from the years that used the 37.5 km decision rule.",
        "Explore mode lets you redistribute strength across swim, bike and run while keeping the target framework intact.",
      ],
    },
    {
      heading: "How to interpret it",
      bullets: [
        "The summary table translates the target into leg times and paces.",
        "The detailed chart overlays recommended speed with the course profile to show where the plan accelerates or softens.",
        "Changing the discipline preferences shifts the distribution while preserving the overall pacing logic.",
      ],
    },
    {
      heading: "Why it is useful",
      bullets: [
        "It turns historical Black Shirt outcomes into a realistic pacing benchmark.",
        "It helps test how discipline strengths affect a full-race plan before race day.",
      ],
    },
  ],
};
