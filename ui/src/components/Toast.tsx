import { useEffect } from "react"
import { C } from "@/lib/theme"
import { Icon } from "./Icon"

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [message, onDismiss])
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%",
      transform: "translateX(-50%)", zIndex: 70,
      background: C.ink, color: "#fff",
      padding: "12px 18px", borderRadius: 999,
      boxShadow: "0 8px 24px rgba(31,26,18,0.25)",
      display: "flex", alignItems: "center", gap: 10, fontSize: 13,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: C.jade, display: "inline-flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="check2" size={12} color="#fff" stroke={3} />
      </span>
      {message}
    </div>
  )
}
