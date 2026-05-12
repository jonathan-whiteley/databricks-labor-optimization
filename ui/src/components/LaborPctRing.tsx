import { C, theme } from "@/lib/theme"
import { Icon } from "./Icon"

interface Props {
  pct: number          // labor cost / predicted sales, e.g. 0.247 = 24.7 %
  size?: number        // overall diameter
}

// Tiny donut + verdict pill showing labor cost as a share of predicted
// sales. Three zones, plus a hard "OVER" flag when pct >= 100 %.
export function LaborPctRing({ pct, size = 56 }: Props) {
  const { lo, hi, critical } = theme.laborTarget
  const safe = isFinite(pct) ? Math.max(0, pct) : 0
  const overSales = safe >= 1
  const display = (safe * 100)

  const ringColor =
    overSales            ? C.primary :
    safe > critical      ? C.primary :
    safe > hi            ? C.gold    :
    safe < lo            ? C.gold    :
                           C.jade
  const verdict =
    overSales            ? "Over sales" :
    safe > critical      ? "Over"       :
    safe > hi            ? "High"       :
    safe < lo            ? "Light"      :
                           "On target"

  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const visiblePct = Math.min(1, safe)
  const dash = circ * visiblePct

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={C.creamDeep} strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={ringColor} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, color: C.ink,
          fontFeatureSettings: '"tnum"',
        }}>
          {display >= 1000 ? "999+%" : `${display.toFixed(display >= 100 ? 0 : 1)}%`}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.ink3,
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Labor % of sales
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <span style={{ color: ringColor, fontSize: 11, fontWeight: 500 }}>
            ● {verdict}
          </span>
        </div>
        {overSales && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
            padding: "2px 6px", borderRadius: 6,
            background: `${C.primary}15`, color: C.primary,
            fontSize: 10, fontWeight: 600,
          }}>
            <Icon name="flame" size={10} color={C.primary} stroke={2} />
            Labor exceeds sales
          </div>
        )}
      </div>
    </div>
  )
}
