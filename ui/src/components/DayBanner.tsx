import { C, theme, fmt$, fmt$k } from "@/lib/theme"
import { Icon } from "./Icon"

interface Props {
  date: string
  totalRev: number
  totalCost: number
  baseRev: number
  baseCost: number
  laborPct: number
  headcount: number
  baseHc: number
  overrideCount: number
  refreshing: boolean
  onRefresh: () => void
  lastRun: string
  // true when the displayed date is the actual "tomorrow"; false when the
  // app clamped to the latest forecasted day because tomorrow is past the
  // forecast horizon (stale-data demo case).
  isTomorrow: boolean
}

export function DayBanner({
  date, totalRev, totalCost, baseRev, baseCost,
  laborPct, headcount, baseHc, overrideCount, refreshing, onRefresh, lastRun, isTomorrow,
}: Props) {
  const d = new Date(date + "T00:00:00")
  const day = d.toLocaleDateString("en-US", { weekday: "long" })
  const dateLabel = d.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  const tooHigh = laborPct > 0.27
  const tooLow = laborPct < 0.20
  const verdict = tooHigh ? "Above target" : tooLow ? "Below target" : "On target"
  const pillColor = tooHigh ? "#FFB7B0" : tooLow ? "#F2C879" : "#92E0BB"

  const safePct = isFinite(laborPct) ? laborPct : 0

  return (
    <section style={{
      background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 60%, ${C.primaryDeep} 100%)`,
      borderRadius: 20, padding: "28px 32px", color: "#fff",
      position: "relative", overflow: "hidden",
      boxShadow: `0 8px 24px ${C.primary}40`,
    }}>
      <img src={theme.logoPath} style={{
        position: "absolute", right: -40, top: -40, width: 240, height: 240,
        opacity: 0.10, transform: "rotate(-10deg)", pointerEvents: "none",
      }} alt="" />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 32, position: "relative", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", background: "rgba(255,255,255,0.15)", borderRadius: 999,
            fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
            textTransform: "uppercase", marginBottom: 10,
          }}>
            <Icon name="sparkle" size={11} color="#fff" /> {isTomorrow ? "Tomorrow's plan" : "Latest available plan"}
          </div>
          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 600,
            letterSpacing: "-0.02em", lineHeight: 1.05,
          }}>
            {day}, {dateLabel}
          </h1>
          <div style={{ marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.85)", maxWidth: 480, lineHeight: 1.5 }}>
            {isTomorrow
              ? "We've forecasted tomorrow's traffic by day-part. Adjust anything you know that we don't, then approve when it looks right."
              : "Showing the most recent day we have a forecast for. Adjust anything you know that we don't, then approve when it looks right."}
          </div>
          <div style={{
            marginTop: 14, display: "flex", alignItems: "center", gap: 12,
            fontSize: 12, color: "rgba(255,255,255,0.75)", flexWrap: "wrap",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: refreshing ? C.gold : "#92E0BB",
                boxShadow: refreshing ? "" : "0 0 8px rgba(146,224,187,0.8)",
              }} />
              {refreshing ? "Refreshing forecast…" : `Forecast updated ${lastRun}`}
            </span>
            <button onClick={onRefresh} disabled={refreshing} style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", border: 0,
              padding: "5px 11px", borderRadius: 999,
              cursor: refreshing ? "wait" : "pointer",
              fontSize: 11, fontWeight: 500,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <Icon name="refresh" size={11} color="#fff" stroke={2} />
              Refresh now
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <BigStat label="Predicted sales"
            value={fmt$(totalRev)}
            delta={overrideCount ? totalRev - baseRev : null}
            suffix="vs forecast" />
          <BigStat label="Recommended labor"
            value={fmt$(totalCost)}
            delta={overrideCount ? totalCost - baseCost : null}
            suffix="vs forecast" />
          <div style={{ paddingLeft: 24, borderLeft: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{
              fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              Labor % of sales
            </div>
            <div style={{
              fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em",
              lineHeight: 1.05, marginTop: 4, fontFeatureSettings: '"tnum"',
            }}>
              {(safePct * 100).toFixed(1)}<span style={{ fontSize: 22, color: "rgba(255,255,255,0.7)" }}>%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11 }}>
              <span style={{ color: pillColor, fontWeight: 500 }}>● {verdict}</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontFamily: '"DM Mono", monospace' }}>
                · goal 22-26%
              </span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
              {headcount} on the schedule
              {overrideCount > 0 && headcount !== baseHc && (
                <span style={{ color: "#fff", fontWeight: 500 }}>
                  {" "}({headcount > baseHc ? "+" : ""}{headcount - baseHc} vs forecast)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BigStat({ label, value, delta, suffix }: {
  label: string; value: string; delta: number | null; suffix: string
}) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.7)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>{label}</div>
      <div style={{
        fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em",
        lineHeight: 1.05, marginTop: 4, fontFeatureSettings: '"tnum"',
      }}>{value}</div>
      {delta != null && delta !== 0 && (
        <div style={{
          fontSize: 11, color: delta > 0 ? "#92E0BB" : "#FFB7B0",
          fontWeight: 500, marginTop: 4, fontFamily: '"DM Mono", monospace',
        }}>
          {delta > 0 ? "+" : "−"}{fmt$k(Math.abs(delta))} {suffix}
        </div>
      )}
    </div>
  )
}
