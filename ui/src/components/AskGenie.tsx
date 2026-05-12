import { useEffect, useRef, useState } from "react"
import { C, theme } from "@/lib/theme"
import { Icon } from "./Icon"

// When VITE_GENIE_SPACE_URL is set, the panel renders the Genie space in
// an iframe instead of the stubbed local conversation. Pre-seeded
// questions become deep links via ?question=…
const GENIE_SPACE_URL = import.meta.env.VITE_GENIE_SPACE_URL as string | undefined

interface Props {
  open: boolean
  onClose: () => void
}

type Msg =
  | { from: "user"; text: string }
  | { from: "genie"; loading: true }
  | { from: "genie"; text: string; viz?: "bars"; data?: [string, number, string][] }
  | { from: "genie"; text: string; viz: "kpi"; data: { value: string; label: string } }

export function AskGenie({ open, onClose }: Props) {
  const [q, setQ] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { if (open) setQ("") }, [open])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  if (!open) return null

  const ask = (text?: string) => {
    const t = (text ?? q).trim()
    if (!t) return
    if (GENIE_SPACE_URL) {
      window.open(`${GENIE_SPACE_URL}?question=${encodeURIComponent(t)}`, "_blank", "noopener")
      return
    }
    const userMsg: Msg = { from: "user", text: t }
    const loadingMsg: Msg = { from: "genie", loading: true }
    setMsgs(prev => [...prev, userMsg, loadingMsg])
    setQ("")
    setTimeout(() => {
      setMsgs(prev => {
        const next = prev.slice(0, -1)
        return [...next, fakeAnswer(t)]
      })
    }, 1100)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(31,26,18,0.45)", backdropFilter: "blur(2px)",
        zIndex: 50, display: "flex", justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, maxWidth: "100%", height: "100%", background: "#fff",
          borderLeft: `1px solid ${C.line}`,
          display: "flex", flexDirection: "column",
          animation: "slideInRight 320ms cubic-bezier(0.2,0.7,0.2,1)",
        }}
      >
        <header style={{
          padding: "18px 20px", borderBottom: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", gap: 12, background: C.cream,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="sparkle" size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em" }}>
              {theme.genie.title}
            </div>
            <div style={{ fontSize: 11, color: C.ink2 }}>{theme.genie.subtitle}</div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: 0, padding: 8, cursor: "pointer",
            color: C.ink2, borderRadius: 8,
          }}>
            <Icon name="x" size={18} />
          </button>
        </header>

        {GENIE_SPACE_URL ? (
          <iframe
            src={GENIE_SPACE_URL}
            style={{ flex: 1, width: "100%", border: 0 }}
            title={theme.genie.title}
          />
        ) : (
          <>
            <div ref={scrollRef} style={{
              flex: 1, overflowY: "auto", padding: 20,
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              {msgs.length === 0 && (
                <>
                  <div style={{
                    padding: "14px 16px", background: C.cream, borderRadius: 14,
                    border: `1px solid ${C.line}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Icon name="sparkle" size={14} color={C.primary} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                        {theme.genie.greetingLine}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>
                      Ask in plain English. I can pull labor, sales, and forecast data for
                      your store and region.
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: C.ink3,
                    textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 6,
                  }}>
                    Try one of these
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {theme.genie.suggested.map(s => (
                      <button
                        key={s.q}
                        onClick={() => ask(s.q)}
                        style={{
                          textAlign: "left", background: "#fff",
                          border: `1px solid ${C.line}`, borderRadius: 12,
                          padding: "12px 14px", cursor: "pointer",
                          display: "flex", alignItems: "flex-start", gap: 10,
                          transition: "all 200ms cubic-bezier(0.2,0.7,0.2,1)",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = C.primary
                          e.currentTarget.style.background = "#FFF8F7"
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = C.line
                          e.currentTarget.style.background = "#fff"
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, background: "#FFE7E0",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Icon name={s.icon} size={13} color={C.primary} stroke={2} />
                        </div>
                        <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>{s.q}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {msgs.map((m, i) => <MsgRow key={i} m={m} />)}
            </div>

            <div style={{ padding: 14, borderTop: `1px solid ${C.line}`, background: C.cream }}>
              <div style={{
                background: "#fff", borderRadius: 12, padding: 6,
                display: "flex", alignItems: "center", gap: 6,
                border: `1px solid ${C.line}`,
              }}>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && ask()}
                  placeholder="Ask anything…"
                  style={{
                    flex: 1, border: 0, outline: 0,
                    font: '400 14px/1.5 "DM Sans", sans-serif',
                    padding: "6px 10px", color: C.ink, background: "transparent",
                  }}
                />
                <button onClick={() => ask()} style={{
                  background: C.primary, color: "#fff", border: 0,
                  padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                  display: "inline-flex",
                }}>
                  <Icon name="arrow" size={14} color="#fff" />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function MsgRow({ m }: { m: Msg }) {
  if (m.from === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background: C.primary, color: "#fff",
          borderRadius: "14px 14px 4px 14px", padding: "10px 14px",
          fontSize: 13, lineHeight: 1.5, maxWidth: 320,
        }}>
          {m.text}
        </div>
      </div>
    )
  }
  const isLoading = "loading" in m
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name="sparkle" size={14} color="#fff" />
      </div>
      <div style={{
        flex: 1, background: C.cream,
        borderRadius: "14px 14px 14px 4px", padding: "12px 14px", minWidth: 0,
      }}>
        {isLoading ? (
          <div style={{
            display: "inline-flex", gap: 4, alignItems: "center",
            color: C.ink2, fontSize: 13, fontStyle: "italic",
          }}>
            Thinking
            <span style={{ display: "inline-flex", gap: 2 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.ink2, animation: "pulse 1.4s infinite" }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.ink2, animation: "pulse 1.4s infinite 0.2s" }} />
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.ink2, animation: "pulse 1.4s infinite 0.4s" }} />
            </span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.ink }}>{m.text}</div>
            {m.viz === "bars" && m.data && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 70px", gap: "6px 10px" }}>
                {m.data.map(([n, w, v]) => (
                  <div key={n} style={{ display: "contents" }}>
                    <div style={{ position: "relative", background: "#fff", borderRadius: 6, height: 22, overflow: "hidden" }}>
                      <div style={{
                        position: "absolute", inset: 0, width: `${w}%`,
                        background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`,
                        borderRadius: 6,
                      }} />
                      <span style={{
                        position: "absolute", left: 8, top: 3, fontSize: 11, fontWeight: 500,
                        color: "#fff", mixBlendMode: "difference",
                      }}>{n}</span>
                    </div>
                    <div style={{
                      fontSize: 12, fontFamily: '"DM Mono", monospace',
                      color: C.ink, alignSelf: "center", textAlign: "right", fontWeight: 500,
                    }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {m.viz === "kpi" && (
              <div style={{
                marginTop: 10, padding: "10px 14px", background: "#fff",
                borderRadius: 10, display: "flex", alignItems: "baseline", gap: 8,
              }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: C.primary, letterSpacing: "-0.01em" }}>
                  {m.data.value}
                </span>
                <span style={{ fontSize: 12, color: C.ink2 }}>{m.data.label}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function fakeAnswer(q: string): Msg {
  const ql = q.toLowerCase()
  if (ql.includes("region") && ql.includes("last week")) {
    return { from: "genie",
      text: "Your store ran 24.8% labor last week vs. 25.6% region average. You came in 0.8 pp under your peers — nice work.",
      viz: "bars",
      data: [["Your store", 78, "24.8%"], ["Region avg", 80, "25.6%"], ["Region best", 64, "20.4%"], ["Region worst", 100, "32.1%"]] }
  }
  if (ql.includes("drive-thru") || ql.includes("abandonment")) {
    return { from: "genie",
      text: "Abandonment spiked when forecasted lunch exceeded $2.0k/hr — 3 such days in the past 14, all Fridays.",
      viz: "bars",
      data: [["Apr 24 (Fri)", 92, "7.2%"], ["Apr 26 (Sun)", 30, "2.1%"], ["May 1 (Fri)", 88, "6.8%"], ["May 3 (Sun)", 28, "1.9%"]] }
  }
  if (ql.includes("overrid")) {
    return { from: "genie",
      text: "Lunch is your most-overridden day-part — 11 of last month's 30 days.",
      viz: "bars",
      data: [["Lunch", 100, "11"], ["Dinner", 36, "4"], ["Breakfast", 9, "1"], ["Late", 9, "1"]] }
  }
  if (ql.includes("actual") && ql.includes("friday")) {
    return { from: "genie",
      text: "Friday May 2 — actuals came in $14,820 (recommended $14,140). You ran $680 over plan, mostly on a +1 cook in lunch.",
      viz: "kpi",
      data: { value: "+$680", label: "over recommended" } }
  }
  if (ql.includes("top") && ql.includes("variance")) {
    return { from: "genie",
      text: "Top 5 stores by absolute labor variance in LA Metro this week:",
      viz: "bars",
      data: [["#0418 Glendale", 100, "+$2.4k"], ["#0207 Arcadia", 72, "+$1.7k"], ["#0556 Burbank", 54, "-$1.3k"], ["#0331 Rosemead", 47, "+$1.1k"], ["#0142 Pasadena", 31, "-$0.7k"]] }
  }
  return { from: "genie",
    text: `Got it — let me look into "${q}". For richer detail try one of the suggested questions, or rephrase with a specific time window or metric.` }
}
