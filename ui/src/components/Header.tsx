import { useState } from "react"
import { C, theme } from "@/lib/theme"
import { Icon } from "./Icon"
import type { Store } from "@/lib/api"

interface Props {
  store: Store | null
  stores: Store[]
  onChangeStore: (s: Store) => void
  weather: string
}

export function Header({ store, stores, onChangeStore, weather }: Props) {
  const [storeOpen, setStoreOpen] = useState(false)
  const now = new Date()
  const greetingWord =
    now.getHours() < 11 ? "Good morning" :
    now.getHours() < 17 ? "Good afternoon" :
                          "Good evening"
  const { firstName, role, initials } = theme.greeting

  return (
    <header style={{
      background: "#fff",
      borderBottom: `1px solid ${C.line}`,
      padding: "14px 32px",
      display: "flex", alignItems: "center", gap: 24,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src={theme.logoPath} style={{ width: 40, height: 40 }} alt="" />
        <div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: C.ink,
            letterSpacing: "-0.01em", lineHeight: 1, fontFamily: '"DM Sans", sans-serif',
          }}>
            {theme.wordmark.lead} <span style={{ color: C.primary }}>{theme.wordmark.accent}</span>
          </div>
          <div style={{
            fontSize: 10, color: C.ink3, textTransform: "uppercase",
            letterSpacing: "0.12em", marginTop: 2, fontWeight: 500,
          }}>
            {theme.appTagline}
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <button onClick={() => setStoreOpen(!storeOpen)} style={{
          background: C.cream, border: `1px solid ${C.line}`, padding: "8px 14px",
          borderRadius: 999, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13, color: C.ink,
        }}>
          <Icon name="store" size={14} color={C.primary} />
          {store ? (
            <>
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: C.ink2 }}>
                #{String(store.store_id).padStart(4, "0")}
              </span>
              <span style={{ fontWeight: 500 }}>{store.store_name}</span>
            </>
          ) : (
            <span style={{ fontWeight: 500, color: C.ink2 }}>Select a store…</span>
          )}
          <Icon name="chevd" size={13} color={C.ink3} />
        </button>
        {storeOpen && stores.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`,
            boxShadow: "0 12px 32px rgba(31,26,18,0.12)",
            minWidth: 320, zIndex: 30, overflow: "hidden", maxHeight: 360, overflowY: "auto",
          }}>
            <div style={{
              padding: "10px 14px", fontSize: 10, color: C.ink3,
              textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500,
              borderBottom: `1px solid ${C.line}`, background: C.cream,
            }}>
              Your stores
            </div>
            {stores.map((s, i) => {
              const isCurrent = store && s.store_id === store.store_id
              return (
                <button key={s.store_id} onClick={() => { onChangeStore(s); setStoreOpen(false) }} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "12px 14px", background: "transparent", border: 0, cursor: "pointer",
                  borderTop: i > 0 ? `1px solid ${C.line}` : 0,
                  textAlign: "left",
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isCurrent ? C.primary : C.cream,
                    color: isCurrent ? "#fff" : C.ink2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 600,
                  }}>
                    {String(s.store_id).padStart(4, "0")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{s.store_name}</div>
                    <div style={{ fontSize: 11, color: C.ink3 }}>{s.region} · {s.state}</div>
                  </div>
                  {isCurrent && <Icon name="check" size={14} color={C.primary} stroke={2.5} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", background: C.cream, borderRadius: 999, fontSize: 12,
      }}>
        <span style={{ fontSize: 14 }}>☀️</span>
        <span style={{ color: C.ink2 }}>{weather}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{
          background: "transparent", border: 0, padding: 6, cursor: "pointer",
          color: C.ink2, position: "relative",
        }}>
          <Icon name="bell" size={18} />
          <span style={{
            position: "absolute", top: 4, right: 4, width: 7, height: 7,
            borderRadius: "50%", background: C.primary, border: "2px solid #fff",
          }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>
              {greetingWord}, {firstName}
            </div>
            <div style={{ fontSize: 10, color: C.ink3, lineHeight: 1.2 }}>{role}</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
          }}>
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
