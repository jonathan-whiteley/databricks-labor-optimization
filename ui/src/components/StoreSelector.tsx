import { useQuery } from "@tanstack/react-query"
import { listStores } from "@/lib/api"

interface Props { value: number | null; onChange: (id: number) => void }

export function StoreSelector({ value, onChange }: Props) {
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: listStores })
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Store:</span>
      <select
        value={value ?? ""}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-slate-300 rounded-md px-3 py-1.5 bg-white"
      >
        <option value="" disabled>Select…</option>
        {stores.map(s => (
          <option key={s.store_id} value={s.store_id}>
            #{s.store_id} — {s.store_name} ({s.state})
          </option>
        ))}
      </select>
    </div>
  )
}
