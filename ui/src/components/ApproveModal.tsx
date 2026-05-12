import { useEffect, useState } from "react"
import { C, theme, fmt$ } from "@/lib/theme"
import { Icon } from "./Icon"
import { saveSchedule, type DayPartRec, type Store } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  store: Store
  date: string
  perDayPart: Record<string, DayPartRec>
  totals: { predRev: number; predCost: number; headcount: number }
  overrideCount: number
}

export function ApproveModal({
  open, onClose, onSaved, store, date, perDayPart, totals, overrideCount,
}: Props) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (open) { setReason(""); setError(null) } }, [open])

  if (!open) return null

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      await saveSchedule({
        store_id: store.store_id,
        schedule_date: date,
        day_parts: Object.entries(perDayPart).map(([dp, r]) => ({
          day_part: dp,
          approved_headcount: r.recommended_headcount,
          approved_cost: r.recommended_cost,
          approved_role_cook: r.recommended_role_mix.cook,
          approved_role_cashier: r.recommended_role_mix.cashier,
          approved_role_shift_lead: r.recommended_role_mix.shift_lead,
          approved_role_manager: r.recommended_role_mix.manager,
        })),
        override_reason: reason || null,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(31,26,18,0.45)", backdropFilter: "blur(2px)",
        zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20, width: "100%",
          maxWidth: 540, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(31,26,18,0.3)",
        }}
      >
        <div style={{
          padding: 24,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
          color: "#fff", position: "relative", overflow: "hidden",
        }}>
          <img src={theme.logoPath} alt="" style={{
            position: "absolute", right: -20, top: -20, width: 140, height: 140,
            opacity: 0.12, transform: "rotate(-10deg)",
          }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="check2" size={22} color="#fff" stroke={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
                Lock in tomorrow's plan
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                Store #{String(store.store_id).padStart(4, "0")} · {store.store_name}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0, background: C.cream, borderRadius: 14,
            overflow: "hidden", border: `1px solid ${C.line}`,
          }}>
            {([
              ["Sales", fmt$(totals.predRev)],
              ["Labor", fmt$(totals.predCost)],
              ["Crew",  String(totals.headcount)],
            ] as const).map(([l, v], i) => (
              <div key={l} style={{
                padding: "14px 16px",
                borderRight: i < 2 ? `1px solid ${C.line}` : 0,
              }}>
                <div style={{
                  fontSize: 10, color: C.ink3,
                  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
                }}>{l}</div>
                <div style={{
                  fontSize: 22, fontWeight: 600, color: C.ink, marginTop: 2,
                  letterSpacing: "-0.01em", fontFeatureSettings: '"tnum"',
                }}>{v}</div>
              </div>
            ))}
          </div>

          {overrideCount > 0 && (
            <div style={{ marginTop: 18 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: C.ink,
                display: "block", marginBottom: 6,
              }}>
                Why the change?{" "}
                <span style={{ color: C.ink3, fontWeight: 400 }}>(helps the model learn from you)</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Pasadena High School graduation — expecting a bigger lunch crowd."
                style={{
                  width: "100%", minHeight: 84, padding: "12px 14px",
                  borderRadius: 12, border: `1px solid ${C.line}`,
                  font: '400 13px/1.5 "DM Sans", sans-serif',
                  color: C.ink, resize: "vertical", outline: 0, background: "#fff",
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, color: C.primary, fontSize: 12 }}>{error}</div>
          )}
        </div>

        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${C.line}`,
          display: "flex", justifyContent: "flex-end", gap: 10, background: C.cream,
        }}>
          <button onClick={onClose} disabled={saving} style={{
            background: "#fff", color: C.ink, border: `1px solid ${C.line}`,
            padding: "10px 18px", borderRadius: 999, cursor: "pointer",
            font: '500 13px/1 "DM Sans", sans-serif',
          }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{
            background: C.primary, color: "#fff", border: 0,
            padding: "10px 22px", borderRadius: 999, cursor: "pointer",
            font: '500 13px/1 "DM Sans", sans-serif',
            display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: `0 2px 8px ${C.primary}55`, opacity: saving ? 0.7 : 1,
          }}>
            <Icon name="check2" size={13} color="#fff" stroke={2.5} />
            {saving ? "Saving…" : "Approve schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}
