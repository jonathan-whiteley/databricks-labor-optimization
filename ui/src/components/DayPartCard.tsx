import { AnimatedNumber } from "./AnimatedNumber"
import { RoleMixIcons } from "./RoleMixIcons"
import { LaborProgressBar } from "./LaborProgressBar"
import type { RoleMix } from "@/lib/api"

interface Props {
  dayPart: "breakfast" | "lunch" | "dinner" | "late"
  predictedRevenue: number
  recommendedHeadcount: number
  recommendedCost: number
  roleMix: RoleMix
  editable?: boolean
  onRevenueChange?: (v: number) => void
  delta?: { headcount: number; cost: number } | null
}

const formatUSD = (n: number) => "$" + Math.round(n).toLocaleString()

export function DayPartCard(props: Props) {
  const laborPct = props.predictedRevenue > 0
    ? (props.recommendedCost / props.predictedRevenue) * 100 : 0
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border border-slate-100">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">{props.dayPart}</div>

      {props.editable ? (
        <div className="mb-4">
          <label className="block text-xs text-slate-500 mb-1">Projected revenue</label>
          <input
            type="number"
            value={Math.round(props.predictedRevenue)}
            onChange={e => props.onRevenueChange?.(Number(e.target.value))}
            className="w-full text-3xl font-semibold tabular border-b-2 border-panda-red focus:outline-none bg-transparent"
            min={0} max={100000} step={50}
          />
        </div>
      ) : (
        <div className="text-3xl font-semibold tabular mb-4">
          <AnimatedNumber value={props.predictedRevenue} format={formatUSD} />
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="text-xs text-slate-500">Recommended crew</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular">
              <AnimatedNumber value={props.recommendedHeadcount} />
            </div>
            <div className="text-sm text-slate-500">people</div>
          </div>
          <div className="mt-2"><RoleMixIcons mix={props.roleMix} /></div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Labor cost</div>
          <div className="text-lg tabular">
            <AnimatedNumber value={props.recommendedCost} format={formatUSD} />
          </div>
        </div>

        <LaborProgressBar laborPct={laborPct} />

        {props.delta && (props.delta.headcount !== 0 || props.delta.cost !== 0) && (
          <div className="text-sm text-panda-red">
            {props.delta.headcount > 0 ? `+${props.delta.headcount}` : props.delta.headcount} crew,{" "}
            {props.delta.cost > 0 ? `+${formatUSD(props.delta.cost)}` : `-${formatUSD(-props.delta.cost)}`} vs. original
          </div>
        )}
      </div>
    </div>
  )
}
