import { useState } from "react"
import { saveSchedule, type DayPartRec } from "@/lib/api"

interface Props {
  storeId: number
  date: string
  perDayPart: Record<string, { revenue: number; rec: DayPartRec; originalRec?: DayPartRec }>
  onClose: () => void
  onSaved: () => void
}

export function ApproveModal({ storeId, date, perDayPart, onClose, onSaved }: Props) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overrideExists = Object.values(perDayPart).some(
    v => v.originalRec && v.rec.recommended_headcount !== v.originalRec.recommended_headcount
  )

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      await saveSchedule({
        store_id: storeId,
        schedule_date: date,
        day_parts: Object.entries(perDayPart).map(([dp, v]) => ({
          day_part: dp,
          approved_headcount: v.rec.recommended_headcount,
          approved_cost: v.rec.recommended_cost,
          approved_role_cook: v.rec.recommended_role_mix.cook,
          approved_role_cashier: v.rec.recommended_role_mix.cashier,
          approved_role_shift_lead: v.rec.recommended_role_mix.shift_lead,
          approved_role_manager: v.rec.recommended_role_mix.manager,
        })),
        override_reason: reason || null,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-[480px]">
        <h2 className="text-lg font-semibold mb-2">Approve tomorrow's schedule?</h2>
        <p className="text-sm text-slate-600 mb-4">
          Saves all four day-parts to Lakebase. {overrideExists && "Includes manager overrides."}
        </p>
        {overrideExists && (
          <label className="block text-sm mb-3">
            <span className="text-slate-700">Reason for override (optional)</span>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-md p-2 text-sm" rows={3}
              placeholder="e.g., Local high school graduation expected to drive lunch"
            />
          </label>
        )}
        {error && <div className="text-sm text-panda-red mb-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 rounded-lg bg-panda-red text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Approve & save"}
          </button>
        </div>
      </div>
    </div>
  )
}
