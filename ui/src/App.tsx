import { useState, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { TopBar } from "./components/TopBar"
import { TodayScreen } from "./screens/Today"
import { AdjustScreen, type AdjustState } from "./screens/Adjust"
import { ApproveModal } from "./components/ApproveModal"
import type { ForecastResponse, RecommendationResponse, DayPartRec } from "./lib/api"

const STORE_KEY = "panda.selectedStore"

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function App() {
  const qc = useQueryClient()
  const [storeId, setStoreId] = useState<number | null>(() => {
    const v = localStorage.getItem(STORE_KEY)
    return v ? Number(v) : null
  })
  useEffect(() => {
    if (storeId !== null) localStorage.setItem(STORE_KEY, String(storeId))
  }, [storeId])

  const date = useMemo(() => tomorrow(), [])
  const [screen, setScreen] = useState<"today" | "adjust">("today")
  const [pending, setPending] = useState<AdjustState | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const approveFromToday = () => {
    if (!storeId) return
    const recData = qc.getQueryData<RecommendationResponse>(["rec", storeId, date])
    const fcData = qc.getQueryData<ForecastResponse>(["forecast", storeId, date])
    if (!recData || !fcData) return
    const map: Record<string, { revenue: number; rec: DayPartRec; originalRec: DayPartRec }> = {}
    for (const dp of fcData.day_parts) {
      const rec = recData.day_parts.find(x => x.day_part === dp.day_part)!
      map[dp.day_part] = { revenue: dp.predicted_revenue, rec, originalRec: rec }
    }
    setPending({ storeId, date, perDayPart: map })
    setApproveOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar storeId={storeId} onStoreChange={setStoreId} />
      <main className="flex-1 px-8 py-6 max-w-7xl w-full mx-auto">
        {storeId === null ? (
          <p className="text-slate-500">Select a store to begin.</p>
        ) : screen === "today" ? (
          <TodayScreen
            storeId={storeId}
            date={date}
            onAdjust={() => setScreen("adjust")}
            onApprove={approveFromToday}
          />
        ) : (
          <AdjustScreen
            storeId={storeId}
            date={date}
            onCancel={() => setScreen("today")}
            onApprove={s => { setPending(s); setApproveOpen(true) }}
          />
        )}
      </main>
      {approveOpen && pending && (
        <ApproveModal
          storeId={pending.storeId}
          date={pending.date}
          perDayPart={pending.perDayPart}
          onClose={() => setApproveOpen(false)}
          onSaved={() => {
            setApproveOpen(false)
            setScreen("today")
            setPending(null)
            setToast("Schedule saved to Lakebase")
            setTimeout(() => setToast(null), 4000)
          }}
        />
      )}
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
