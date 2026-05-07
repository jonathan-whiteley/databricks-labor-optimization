import { AnimatedNumber } from "./AnimatedNumber"

const formatUSD = (n: number) => "$" + Math.round(n).toLocaleString()

export function TotalsStrip({ totalRevenue, totalCost }: { totalRevenue: number; totalCost: number }) {
  const pct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0
  return (
    <div className="flex items-center gap-8 px-6 py-4 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Total revenue</div>
        <div className="text-2xl font-semibold tabular">
          <AnimatedNumber value={totalRevenue} format={formatUSD} />
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Labor cost</div>
        <div className="text-2xl font-semibold tabular">
          <AnimatedNumber value={totalCost} format={formatUSD} />
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Labor %</div>
        <div className={`text-2xl font-semibold tabular ${pct > 25 ? "text-panda-red" : "text-emerald-700"}`}>
          <AnimatedNumber value={pct} format={n => n.toFixed(1) + "%"} />
        </div>
      </div>
    </div>
  )
}
