// Brand theme contract. To support a new company:
//   1. Add a new file under ./themes/<brand>.ts that exports a Theme.
//   2. Set VITE_BRAND=<brand> at build time (or change the default below).
// Everything visual (palette, wordmark, day-part labels, greeting voice,
// approval table demo rows, suggested Genie questions) is reachable from
// this object — no other module should hardcode brand strings or colors.

export type DayPartId = "breakfast" | "lunch" | "dinner" | "late"

export interface DayPartTheme {
  tint: string
  deep: string
  icon: "sunrise" | "sun" | "sunset" | "moon"
  label: string
  time: string
  blurb: string
}

export interface Theme {
  brand: string                     // machine slug, e.g. "lakehouse"
  wordmark: { lead: string; accent: string }
  appTagline: string                // e.g. "Daily Planner"
  logoPath: string                  // public path, e.g. "/logo.svg"
  palette: {
    primary: string                 // brand-lead red / hue used for hero and CTAs
    primaryDark: string
    primaryDeep: string
    cream: string                   // page background
    creamDeep: string
    paper: string
    ink: string                     // warm near-black
    ink2: string                    // warm secondary
    ink3: string                    // warm tertiary
    line: string                    // hairline borders
    gold: string
    jade: string
  }
  dayparts: Record<DayPartId, DayPartTheme>
  hourCurves: Record<DayPartId, number[]>   // 0..1 bars rendered atop the daypart band
  greeting: { firstName: string; role: string; initials: string }
  // Labor cost as % of predicted sales — thresholds for the per-card ring.
  //   lo..hi      → on target (green)
  //   < lo        → below target (amber, may be understaffed)
  //   hi < x ≤ critical → above target (gold/amber)
  //   x > critical → over (red)
  //   x >= 1      → "over 100%" flagged hard
  laborTarget: { lo: number; hi: number; critical: number }
  weatherChipDefault: string
  genie: {
    title: string                   // e.g. "Ask Genie"
    subtitle: string                // e.g. "Your data assistant · powered by Genie"
    greetingLine: string            // e.g. "Hi Marisol — what would you like to know?"
    suggested: { icon: string; q: string }[]
  }
  recentDays: {
    date: string
    forecast: string
    approved: string
    deltaCrew: string
    deltaCost: string
    reason: string
    actual: string
  }[]
}

import { pandaTheme } from "./themes/panda"
import { lakehouseTheme } from "./themes/lakehouse"

const REGISTRY: Record<string, Theme> = { panda: pandaTheme, lakehouse: lakehouseTheme }

const brandKey =
  (import.meta.env.VITE_BRAND as string | undefined) ?? "lakehouse"

export const theme: Theme = REGISTRY[brandKey] ?? lakehouseTheme

// Convenience re-exports so call sites stay short.
export const C = theme.palette
export const DP_THEME = theme.dayparts
export const HOUR_CURVE = theme.hourCurves
export const DAYPART_IDS: DayPartId[] = ["breakfast", "lunch", "dinner", "late"]

export const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString("en-US")
export const fmt$k = (n: number) =>
  n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n)

// The served pyfunc model occasionally returns a `recommended_headcount`
// that disagrees with the sum of `recommended_role_mix`. The role mix is
// what shows on the floor — treat it as the source of truth.
export function crewCount(roles: { cook: number; cashier: number; shift_lead: number; manager: number }): number {
  return roles.cook + roles.cashier + roles.shift_lead + roles.manager
}
