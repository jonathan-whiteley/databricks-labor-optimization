import { useEffect, useState } from "react"
import { C, DP_THEME, HOUR_CURVE, fmt$, fmt$k, type DayPartId } from "@/lib/theme"
import type { RoleMix } from "@/lib/api"
import { Icon } from "./Icon"
import { LaborPctRing } from "./LaborPctRing"

interface Props {
  id: DayPartId
  baselineRevenue: number
  override: number | null
  onOverride: (v: number) => void
  onClear: () => void
  baselineRec: {
    recommended_headcount: number
    recommended_cost: number
    recommended_role_mix: RoleMix
  }
  currentRec: {
    recommended_headcount: number
    recommended_cost: number
    recommended_role_mix: RoleMix
  }
  recomputing: boolean
  showConfidence: boolean
  confidencePct: number
}

export function DaypartCard({
  id, baselineRevenue, override, onOverride, onClear,
  baselineRec, currentRec, recomputing, showConfidence, confidencePct,
}: Props) {
  const t = DP_THEME[id]
  const curve = HOUR_CURVE[id]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const revenue = override ?? baselineRevenue
  const isOverridden = override != null
  const hcDelta = currentRec.recommended_headcount - baselineRec.recommended_headcount
  const costDelta = currentRec.recommended_cost - baselineRec.recommended_cost

  useEffect(() => {
    if (editing) setDraft(String(Math.round(revenue)))
  }, [editing, revenue])

  const commit = () => {
    const n = parseFloat(draft.replace(/[^0-9.]/g, ""))
    if (!isNaN(n) && n >= 0) {
      if (Math.round(n) === Math.round(baselineRevenue)) onClear()
      else onOverride(n)
    }
    setEditing(false)
  }

  return (
    <article style={{
      background: "#fff",
      borderRadius: 20,
      border: isOverridden ? `2px solid ${t.deep}` : `1px solid ${C.line}`,
      padding: 0,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      boxShadow: isOverridden ? `0 8px 24px ${t.deep}25` : "0 1px 2px rgba(31,26,18,0.04)",
      transition: "box-shadow 200ms cubic-bezier(0.2,0.7,0.2,1)",
      position: "relative",
    }}>
      {isOverridden && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: t.deep, color: "#fff",
          fontSize: 9, fontWeight: 600, padding: "3px 8px",
          borderRadius: 999, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          Adjusted
        </div>
      )}

      <div style={{
        background: t.tint, padding: "18px 20px 16px", borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: t.deep, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name={t.icon} size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              {t.label}
            </div>
            <div style={{ fontSize: 11, color: C.ink2, marginTop: 2, fontFamily: '"DM Mono", monospace' }}>
              {t.time} · {t.blurb}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 32, marginTop: 14 }}>
          {curve.map((y, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${y * 100}%`,
              background: t.deep,
              opacity: 0.25 + (y * 0.5),
              borderRadius: "4px 4px 1px 1px",
            }} />
          ))}
        </div>
      </div>

      <div style={{ padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: C.ink3,
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            {isOverridden ? "Your estimate" : "Predicted sales"}
          </span>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{
              background: "transparent", border: 0, padding: 0, cursor: "pointer",
              color: isOverridden ? t.deep : C.ink3,
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 500,
            }}>
              <Icon name="edit" size={11} /> {isOverridden ? "Adjust" : "Override"}
            </button>
          )}
        </div>

        {editing ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 4, paddingBottom: 6,
            borderBottom: `2px solid ${t.deep}`,
          }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: C.ink }}>$</span>
            <input
              autoFocus type="text" value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") setEditing(false)
              }}
              style={{
                font: '600 30px/1.1 "DM Sans", sans-serif',
                color: C.ink, border: 0, outline: 0, padding: 0, margin: 0,
                background: "transparent", width: "100%", letterSpacing: "-0.02em",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontSize: 32, fontWeight: 600,
              color: isOverridden ? t.deep : C.ink,
              letterSpacing: "-0.02em",
              fontFeatureSettings: '"tnum"', lineHeight: 1.1,
            }}>
              {fmt$(revenue)}
            </span>
            {isOverridden && (
              <span style={{
                fontSize: 12, color: C.ink3,
                textDecoration: "line-through",
                fontFeatureSettings: '"tnum"',
              }}>
                {fmt$(baselineRevenue)}
              </span>
            )}
          </div>
        )}

        {showConfidence && !editing && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11, color: C.ink3 }}>
            <Icon name={isOverridden ? "edit" : "sparkle"} size={11} color={isOverridden ? t.deep : C.ink3} />
            {isOverridden
              ? "Manual override"
              : `AI forecast · ± ${(confidencePct * 100).toFixed(0)}%`}
          </div>
        )}
      </div>

      <div style={{
        padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <Stat
          label="Crew"
          value={String(currentRec.recommended_headcount)}
          delta={isOverridden ? hcDelta : null}
        />
        <Stat
          label="Labor cost"
          value={fmt$k(currentRec.recommended_cost)}
          delta={isOverridden ? costDelta : null}
          isMoney
        />
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <LaborPctRing pct={revenue > 0 ? currentRec.recommended_cost / revenue : 0} />
      </div>

      <div style={{ padding: "14px 20px 4px" }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.ink3,
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
        }}>
          The crew
        </div>
        <RoleStack roles={currentRec.recommended_role_mix} accent={t.deep} />
      </div>

      {isOverridden && (
        <div style={{
          margin: "14px 20px 18px",
          padding: "10px 12px",
          background: C.cream,
          borderRadius: 10,
          border: `1px dashed ${t.deep}55`,
          display: "flex", alignItems: "center", gap: 8, fontSize: 11,
        }}>
          <Icon name="info" size={12} color={t.deep} />
          <span style={{ flex: 1, color: C.ink2 }}>
            <strong style={{ color: C.ink, fontWeight: 600 }}>
              {hcDelta > 0 ? "+" : ""}{hcDelta} crew · {costDelta >= 0 ? "+" : "−"}{fmt$k(Math.abs(costDelta))}
            </strong>{" "}
            vs. AI forecast{recomputing ? " · recomputing…" : ""}
          </span>
          <button onClick={onClear} style={{
            background: "transparent", border: 0, color: t.deep, cursor: "pointer",
            fontSize: 11, padding: 0, fontWeight: 500,
          }}>
            Reset
          </button>
        </div>
      )}
      {!isOverridden && <div style={{ height: 18 }} />}
    </article>
  )
}

function Stat({ label, value, delta, isMoney }: {
  label: string; value: string; delta: number | null; isMoney?: boolean
}) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: C.ink3,
        textTransform: "uppercase", letterSpacing: "0.1em",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <span style={{
          fontSize: 24, fontWeight: 600, color: C.ink,
          letterSpacing: "-0.01em", fontFeatureSettings: '"tnum"',
        }}>{value}</span>
        {delta != null && delta !== 0 && (
          <span style={{
            fontSize: 11, color: delta > 0 ? C.jade : C.primary,
            fontWeight: 500, fontFamily: '"DM Mono", monospace',
          }}>
            {delta > 0 ? "+" : "−"}{isMoney ? fmt$k(Math.abs(delta)) : Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  )
}

function RoleStack({ roles, accent }: { roles: RoleMix; accent: string }) {
  const items: { count: number; label: string; icon: string; c: string }[] = [
    { count: roles.cook,       label: "Cooks",    icon: "flame", c: accent },
    { count: roles.cashier,    label: "Cashiers", icon: "cash",  c: C.ink2 },
    { count: roles.shift_lead, label: "Leads",    icon: "star",  c: C.gold },
    { count: roles.manager,    label: "Manager",  icon: "user",  c: C.jade },
  ]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(it => it.count > 0 && (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: `${it.c}15`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon name={it.icon} size={12} color={it.c} stroke={2} />
          </div>
          <span style={{ flex: 1, fontSize: 13, color: C.ink }}>{it.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {Array.from({ length: it.count }).map((_, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: it.c,
              }} />
            ))}
          </div>
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 600,
            color: C.ink, minWidth: 14, textAlign: "right",
          }}>
            {it.count}
          </span>
        </div>
      ))}
    </div>
  )
}
