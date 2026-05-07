import { brand } from "@/lib/brand"
import { StoreSelector } from "./StoreSelector"

interface Props {
  storeId: number | null
  onStoreChange: (id: number) => void
}

export function TopBar({ storeId, onStoreChange }: Props) {
  return (
    <header className="flex items-center gap-4 px-8 py-4 bg-white border-b border-slate-200 shadow-sm">
      <img src={brand.logoPath} alt={brand.brandName} className="h-8" />
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-widest text-slate-500">{brand.brandName}</span>
        <span className="text-lg font-semibold leading-none">{brand.appTitle}</span>
      </div>
      <div className="ml-auto">
        <StoreSelector value={storeId} onChange={onStoreChange} />
      </div>
    </header>
  )
}
