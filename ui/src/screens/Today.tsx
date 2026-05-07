import { useQuery } from "@tanstack/react-query"
import { getForecast, getRecommendation } from "@/lib/api"
import { DayPartCard } from "@/components/DayPartCard"
import { TotalsStrip } from "@/components/TotalsStrip"

interface Props {
  storeId: number
  date: string
  onAdjust: () => void
  onApprove: () => void
}

export function TodayScreen({ storeId, date, onAdjust, onApprove }: Props) {
  const f = useQuery({ queryKey: ["forecast", storeId, date], queryFn: () => getForecast(storeId, date) })
  const r = useQuery({ queryKey: ["rec", storeId, date], queryFn: () => getRecommendation(storeId, date) })

  if (f.isLoading || r.isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) =>
        <div key={i} className="bg-white rounded-xl shadow-sm h-72 animate-pulse" />)}
    </div>
  }
  if (f.isError || r.isError) {
    return <div className="text-panda-red">
      Forecast not yet generated for this store/date. Run the refresh job to populate tomorrow's plan.
    </div>
  }

  const forecast = f.data!, rec = r.data!
  const byDayPart = new Map(rec.day_parts.map(d => [d.day_part, d]))
  const totalRevenue = forecast.day_parts.reduce((a, x) => a + x.predicted_revenue, 0)
  const totalCost = rec.day_parts.reduce((a, x) => a + x.recommended_cost, 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Plan for</div>
        <div className="text-2xl font-semibold">
          {new Date(date + "T00:00:00").toLocaleDateString(undefined,
            { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {forecast.day_parts.map(dp => {
          const r = byDayPart.get(dp.day_part)!
          return (
            <DayPartCard
              key={dp.day_part}
              dayPart={dp.day_part as "breakfast" | "lunch" | "dinner" | "late"}
              predictedRevenue={dp.predicted_revenue}
              recommendedHeadcount={r.recommended_headcount}
              recommendedCost={r.recommended_cost}
              roleMix={r.recommended_role_mix}
            />
          )
        })}
      </div>
      <TotalsStrip totalRevenue={totalRevenue} totalCost={totalCost} />
      <div className="flex gap-3">
        <button onClick={onAdjust}
          className="px-5 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 font-medium">
          Adjust forecast
        </button>
        <button onClick={onApprove}
          className="px-5 py-2.5 rounded-lg bg-panda-red text-white hover:opacity-90 font-medium">
          Approve schedule
        </button>
      </div>
    </div>
  )
}
