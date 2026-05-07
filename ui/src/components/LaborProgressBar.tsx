interface Props { laborPct: number; threshold?: number }

export function LaborProgressBar({ laborPct, threshold = 25 }: Props) {
  const clamped = Math.max(0, Math.min(100, laborPct))
  const over = laborPct > threshold
  return (
    <div className="w-full">
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${over ? "bg-panda-red" : "bg-emerald-600"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="text-xs text-slate-500 mt-1 tabular">
        Labor {laborPct.toFixed(1)}%
      </div>
    </div>
  )
}
