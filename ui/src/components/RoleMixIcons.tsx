import type { RoleMix } from "@/lib/api"

const ROLE_LABEL: Record<keyof RoleMix, string> = {
  cook: "Cook", cashier: "Cashier", shift_lead: "Lead", manager: "Mgr",
}
const ROLE_DOT: Record<keyof RoleMix, string> = {
  cook: "bg-amber-500", cashier: "bg-sky-500",
  shift_lead: "bg-emerald-600", manager: "bg-panda-red",
}

export function RoleMixIcons({ mix }: { mix: RoleMix }) {
  const roles: (keyof RoleMix)[] = ["cook", "cashier", "shift_lead", "manager"]
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.flatMap(role =>
        Array.from({ length: mix[role] }).map((_, i) => (
          <span
            key={`${role}-${i}`}
            className={`w-3.5 h-3.5 rounded-full ${ROLE_DOT[role]}`}
            title={ROLE_LABEL[role]}
          />
        ))
      )}
    </div>
  )
}
