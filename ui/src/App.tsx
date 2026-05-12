import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  listStores, getForecast, getRecommendation, recompute,
  type DayPartRec,
} from "@/lib/api"
import { C, DAYPART_IDS, theme, fmt$, crewCount, type DayPartId } from "@/lib/theme"
import { Header } from "@/components/Header"
import { DayBanner } from "@/components/DayBanner"
import { DaypartCard } from "@/components/DayPartCard"
import { ApproveModal } from "@/components/ApproveModal"
import { ApprovalsTable } from "@/components/ApprovalsTable"
import { AskGenie } from "@/components/AskGenie"
import { Toast } from "@/components/Toast"
import { Icon } from "@/components/Icon"

const STORE_KEY = "panda.selectedStoreId"
const CONFIDENCE_BY_DP: Record<DayPartId, number> = {
  breakfast: 0.08, lunch: 0.06, dinner: 0.07, late: 0.12,
}

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function App() {
  const qc = useQueryClient()

  const storesQ = useQuery({ queryKey: ["stores"], queryFn: listStores })
  const stores = storesQ.data ?? []

  const [storeId, setStoreId] = useState<number | null>(() => {
    const v = localStorage.getItem(STORE_KEY)
    return v ? Number(v) : null
  })
  useEffect(() => {
    if (storeId === null && stores.length > 0) setStoreId(stores[0].store_id)
  }, [storeId, stores])
  useEffect(() => {
    if (storeId !== null) localStorage.setItem(STORE_KEY, String(storeId))
  }, [storeId])

  const store = stores.find(s => s.store_id === storeId) ?? null
  const date = useMemo(() => tomorrowISO(), [])

  const fQuery = useQuery({
    queryKey: ["forecast", storeId, date],
    queryFn: () => getForecast(storeId!, date),
    enabled: storeId !== null,
  })
  const rQuery = useQuery({
    queryKey: ["rec", storeId, date],
    queryFn: () => getRecommendation(storeId!, date),
    enabled: storeId !== null,
  })

  const [overrides, setOverrides] = useState<Partial<Record<DayPartId, number>>>({})
  const [overrideRecs, setOverrideRecs] = useState<Partial<Record<DayPartId, DayPartRec>>>({})
  const [recomputing, setRecomputing] = useState<Partial<Record<DayPartId, boolean>>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [lastRun, setLastRun] = useState("5 min ago")
  const [askOpen, setAskOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    setOverrides({}); setOverrideRecs({}); setRecomputing({})
  }, [storeId])

  const baselineRevs: Partial<Record<DayPartId, number>> = useMemo(() => {
    if (!fQuery.data) return {}
    const m: Partial<Record<DayPartId, number>> = {}
    for (const d of fQuery.data.day_parts) m[d.day_part as DayPartId] = d.predicted_revenue
    return m
  }, [fQuery.data])

  // Strip the approval overlay — baseline must remain the AI model's output
  // so deltas read meaningfully.
  const baselineRecs: Partial<Record<DayPartId, DayPartRec>> = useMemo(() => {
    if (!rQuery.data) return {}
    const m: Partial<Record<DayPartId, DayPartRec>> = {}
    for (const d of rQuery.data.day_parts) {
      m[d.day_part as DayPartId] = {
        day_part: d.day_part,
        recommended_headcount: d.recommended_headcount,
        recommended_cost: d.recommended_cost,
        recommended_role_mix: d.recommended_role_mix,
      }
    }
    return m
  }, [rQuery.data])

  // When the rec query lands, seed local overrides for any day-part with a
  // persisted approval where the approved revenue meaningfully differs from
  // the AI forecast (otherwise the manager just rubber-stamped the AI plan
  // and there's nothing to flag as "Adjusted"). Seeding both `overrides`
  // (revenue) AND `overrideRecs` (crew/cost/role mix) avoids a network
  // round-trip on initial render.
  useEffect(() => {
    if (!rQuery.data || !fQuery.data) return
    const baselineByDp = new Map<string, number>(
      fQuery.data.day_parts.map(f => [f.day_part, f.predicted_revenue])
    )
    const newOverrides: Partial<Record<DayPartId, number>> = {}
    const newOverrideRecs: Partial<Record<DayPartId, DayPartRec>> = {}
    for (const d of rQuery.data.day_parts) {
      const base = baselineByDp.get(d.day_part)
      if (!d.approved || base == null) continue
      if (Math.round(d.approved.revenue) === Math.round(base)) continue
      const dp = d.day_part as DayPartId
      newOverrides[dp] = d.approved.revenue
      newOverrideRecs[dp] = {
        day_part: d.day_part,
        recommended_headcount: d.approved.headcount,
        recommended_cost: d.approved.cost,
        recommended_role_mix: d.approved.role_mix,
      }
    }
    if (Object.keys(newOverrides).length > 0) {
      setOverrides(newOverrides)
      setOverrideRecs(newOverrideRecs)
    }
  }, [rQuery.data, fQuery.data])

  // Commit is the explicit "I'm done editing" signal (Enter / blur), so we
  // fire recompute synchronously — no debounce. Each day-part is tracked by
  // the revenue it was last computed for so a fast follow-up edit re-fires.
  const fireRecompute = (dp: DayPartId, sales: number) => {
    if (storeId === null) return
    setRecomputing(prev => ({ ...prev, [dp]: true }))
    recompute({ store_id: storeId, day_part: dp, projected_sales: sales })
      .then(r => setOverrideRecs(prev => ({ ...prev, [dp]: r })))
      .catch(() => { /* keep previous values */ })
      .finally(() => setRecomputing(prev => ({ ...prev, [dp]: false })))
  }

  const setOverride = (dp: DayPartId, v: number) => {
    setOverrides(prev => ({ ...prev, [dp]: v }))
    fireRecompute(dp, v)
  }
  const clearOverride = (dp: DayPartId) => {
    setOverrides(prev => { const x = { ...prev }; delete x[dp]; return x })
    setOverrideRecs(prev => { const x = { ...prev }; delete x[dp]; return x })
    setRecomputing(prev => { const x = { ...prev }; delete x[dp]; return x })
  }
  const anyPending = Object.values(recomputing).some(Boolean)
  const overrideCount = Object.keys(overrides).length

  const currentRec = (dp: DayPartId): DayPartRec | undefined =>
    overrides[dp] != null ? overrideRecs[dp] ?? baselineRecs[dp] : baselineRecs[dp]

  const totals = useMemo(() => {
    let predRev = 0, predCost = 0, baseRev = 0, baseCost = 0, headcount = 0, baseHc = 0
    for (const dp of DAYPART_IDS) {
      const baseR = baselineRevs[dp] ?? 0
      const curR = overrides[dp] ?? baseR
      const baseRec = baselineRecs[dp]
      const curRec = currentRec(dp)
      baseRev += baseR
      predRev += curR
      if (baseRec) {
        baseCost += baseRec.recommended_cost
        baseHc += crewCount(baseRec.recommended_role_mix)
      }
      if (curRec) {
        predCost += curRec.recommended_cost
        headcount += crewCount(curRec.recommended_role_mix)
      }
    }
    return { predRev, predCost, baseRev, baseCost, headcount, baseHc }
  }, [baselineRevs, baselineRecs, overrides, overrideRecs])

  const laborPct = totals.predRev > 0 ? totals.predCost / totals.predRev : 0

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => { setRefreshing(false); setLastRun("just now") }, 1200)
  }

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["rec", storeId, date] })
    setSaveOpen(false)
    setOverrides({}); setOverrideRecs({}); setRecomputing({})
    setToast(`Tomorrow's plan locked in — ${fmt$(totals.predCost)} labor, ${totals.headcount} crew.`)
  }

  const ready = storeId !== null && fQuery.data && rQuery.data
  const isError = fQuery.isError || rQuery.isError

  return (
    <>
      <Header
        store={store}
        stores={stores}
        onChangeStore={s => setStoreId(s.store_id)}
        weather={theme.weatherChipDefault}
      />

      <main style={{
        maxWidth: 1440, margin: "0 auto",
        padding: "24px 32px 80px",
        display: "flex", flexDirection: "column", gap: 24,
      }}>
        {!ready && !isError && (
          <div style={{ color: C.ink3, padding: 40, textAlign: "center" }}>Loading plan…</div>
        )}

        {isError && (
          <div style={{
            padding: 24, background: "#fff", borderRadius: 16,
            border: `1px solid ${C.line}`, color: C.primary,
          }}>
            Forecast not yet generated for this store/date. Run the refresh job to populate tomorrow's plan.
          </div>
        )}

        {ready && store && (
          <>
            <DayBanner
              date={date}
              totalRev={totals.predRev}
              totalCost={totals.predCost}
              baseRev={totals.baseRev}
              baseCost={totals.baseCost}
              laborPct={laborPct}
              headcount={totals.headcount}
              baseHc={totals.baseHc}
              overrideCount={overrideCount}
              refreshing={refreshing}
              onRefresh={refresh}
              lastRun={lastRun}
            />

            <section>
              <div style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                marginBottom: 14,
              }}>
                <div>
                  <h2 style={{
                    margin: 0, fontSize: 20, fontWeight: 600,
                    color: C.ink, letterSpacing: "-0.01em",
                  }}>
                    By day-part
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: C.ink2 }}>
                    Tap any card to override what we forecasted. The crew, cost, and labor %
                    update live.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {overrideCount > 0 && (
                    <button
                      onClick={() => { setOverrides({}); setOverrideRecs({}); setRecomputing({}) }}
                      style={{
                        background: "#fff", border: `1px solid ${C.line}`, color: C.ink2,
                        padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                        fontSize: 12, fontWeight: 500,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Icon name="refresh" size={12} /> Reset all overrides
                    </button>
                  )}
                  <button
                    onClick={() => setSaveOpen(true)}
                    disabled={anyPending}
                    style={{
                      background: C.primary, color: "#fff", border: 0,
                      padding: "10px 20px", borderRadius: 999,
                      cursor: anyPending ? "wait" : "pointer",
                      fontSize: 13, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 6,
                      boxShadow: `0 4px 14px ${C.primary}4d`,
                      opacity: anyPending ? 0.7 : 1,
                    }}
                  >
                    <Icon name="check2" size={14} color="#fff" stroke={2.5} />
                    {anyPending ? "Computing…" : "Approve schedule"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {DAYPART_IDS.map((dp, i) => {
                  const baseR = baselineRevs[dp]
                  const baseRec = baselineRecs[dp]
                  const curRec = currentRec(dp)
                  if (baseR == null || !baseRec || !curRec) {
                    return (
                      <div key={dp} style={{
                        background: "#fff", borderRadius: 20, height: 380,
                        border: `1px solid ${C.line}`,
                      }} />
                    )
                  }
                  return (
                    <div key={dp} className="dp-enter" style={{ animationDelay: `${i * 60}ms` }}>
                      <DaypartCard
                        id={dp}
                        baselineRevenue={baseR}
                        override={overrides[dp] ?? null}
                        onOverride={v => setOverride(dp, v)}
                        onClear={() => clearOverride(dp)}
                        baselineRec={baseRec}
                        currentRec={curRec}
                        recomputing={!!recomputing[dp]}
                        showConfidence
                        confidencePct={CONFIDENCE_BY_DP[dp]}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <ApprovalsTable />

            <ApproveModal
              open={saveOpen}
              onClose={() => setSaveOpen(false)}
              onSaved={handleSaved}
              store={store}
              date={date}
              perDayPart={
                Object.fromEntries(
                  DAYPART_IDS.flatMap(dp => {
                    const rec = currentRec(dp)
                    const rev = overrides[dp] ?? baselineRevs[dp]
                    if (!rec || rev == null) return []
                    return [[dp, { rec, revenue: rev }]]
                  })
                )
              }
              totals={totals}
              overrideCount={overrideCount}
            />
          </>
        )}
      </main>

      {!askOpen && (
        <button onClick={() => setAskOpen(true)} style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 40,
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
          color: "#fff", border: 0, padding: "14px 22px",
          borderRadius: 999, cursor: "pointer",
          fontSize: 14, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 10,
          animation: "fabPulse 3s ease-in-out infinite",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="sparkle" size={14} color="#fff" />
          </span>
          {theme.genie.title}
        </button>
      )}

      <AskGenie open={askOpen} onClose={() => setAskOpen(false)} />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
