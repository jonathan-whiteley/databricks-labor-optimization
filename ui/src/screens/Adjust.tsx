import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getForecast, getRecommendation, recompute, type DayPartRec } from "@/lib/api"
import { DayPartCard } from "@/components/DayPartCard"
import { TotalsStrip } from "@/components/TotalsStrip"

interface Props {
  storeId: number
  date: string
  onCancel: () => void
  onApprove: (state: AdjustState) => void
}

export interface AdjustState {
  storeId: number
  date: string
  perDayPart: Record<string, { revenue: number; rec: DayPartRec; originalRec: DayPartRec }>
}

const ORDER = ["breakfast", "lunch", "dinner", "late"] as const

export function AdjustScreen({ storeId, date, onCancel, onApprove }: Props) {
  const f = useQuery({ queryKey: ["forecast", storeId, date], queryFn: () => getForecast(storeId, date) })
  const r = useQuery({ queryKey: ["rec", storeId, date], queryFn: () => getRecommendation(storeId, date) })

  const initial = useMemo(() => {
    if (!f.data || !r.data) return null
    const map: AdjustState["perDayPart"] = {}
    for (const dp of f.data.day_parts) {
      const rec = r.data.day_parts.find(x => x.day_part === dp.day_part)!
      map[dp.day_part] = { revenue: dp.predicted_revenue, rec, originalRec: rec }
    }
    return map
  }, [f.data, r.data])

  const [state, setState] = useState<AdjustState["perDayPart"] | null>(null)
  useEffect(() => { if (initial && state === null) setState(initial) }, [initial, state])

  // Debounced live recompute when revenue input changes
  const revenueKey = state ? Object.values(state).map(v => v.revenue).join(",") : ""
  useEffect(() => {
    if (!state) return
    const timers: number[] = []
    Object.entries(state).forEach(([dp, val]) => {
      if (val.revenue === val.originalRec.recommended_cost) return
      const t = window.setTimeout(async () => {
        try {
          const newRec = await recompute({
            store_id: storeId, day_part: dp, projected_sales: val.revenue,
          })
          setState(prev => prev && { ...prev, [dp]: { ...prev[dp], rec: newRec } })
        } catch { /* swallow; previous values persist */ }
      }, 300)
      timers.push(t)
    })
    return () => timers.forEach(t => clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueKey])

  if (!state) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) =>
        <div key={i} className="bg-white rounded-xl shadow-sm h-72 animate-pulse" />)}
    </div>
  }

  const totalRevenue = Object.values(state).reduce((a, v) => a + v.revenue, 0)
  const totalCost = Object.values(state).reduce((a, v) => a + v.rec.recommended_cost, 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Adjust forecast for</div>
        <div className="text-2xl font-semibold">
          {new Date(date + "T00:00:00").toLocaleDateString(undefined,
            { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ORDER.map(dp => {
          const v = state[dp]; if (!v) return null
          const delta = {
            headcount: v.rec.recommended_headcount - v.originalRec.recommended_headcount,
            cost: v.rec.recommended_cost - v.originalRec.recommended_cost,
          }
          return (
            <DayPartCard
              key={dp}
              dayPart={dp}
              predictedRevenue={v.revenue}
              recommendedHeadcount={v.rec.recommended_headcount}
              recommendedCost={v.rec.recommended_cost}
              roleMix={v.rec.recommended_role_mix}
              editable
              onRevenueChange={n =>
                setState(prev => prev && { ...prev, [dp]: { ...prev[dp], revenue: n } })}
              delta={delta}
            />
          )
        })}
      </div>
      <TotalsStrip totalRevenue={totalRevenue} totalCost={totalCost} />
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="px-5 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 font-medium">
          Cancel
        </button>
        <button onClick={() => onApprove({ storeId, date, perDayPart: state })}
          className="px-5 py-2.5 rounded-lg bg-panda-red text-white hover:opacity-90 font-medium">
          Approve schedule
        </button>
      </div>
    </div>
  )
}
