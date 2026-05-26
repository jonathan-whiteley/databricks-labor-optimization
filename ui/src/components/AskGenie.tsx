import { useEffect, useRef, useState } from "react"
import { C, theme } from "@/lib/theme"
import { Icon } from "./Icon"
import { askGenie, type GenieTable } from "@/lib/api"

// When VITE_GENIE_SPACE_URL is set, the panel header gets an "Open in
// Genie" launcher that pops the full Genie space in a new tab (the parent
// app's auth context carries over). Embedding via iframe is blocked by
// Databricks' frame-ancestors CSP today, so we open-in-new-tab instead.
// Pre-seeded questions deep-link via ?question=… so they land already-asked.
const GENIE_SPACE_URL = import.meta.env.VITE_GENIE_SPACE_URL as string | undefined

interface Props {
  open: boolean
  onClose: () => void
}

type Msg =
  | { from: "user"; text: string }
  | { from: "genie"; loading: true }
  | {
      from: "genie"
      text: string
      sql?: string | null
      table?: GenieTable | null
      error?: boolean
    }

export function AskGenie({ open, onClose }: Props) {
  const [q, setQ] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([])
  // The Genie conversation_id persists across follow-ups so Genie can
  // reason about "that" / "the previous result". Reset clears it.
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { if (open) setQ("") }, [open])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  if (!open) return null

  const reset = () => {
    setMsgs([])
    setQ("")
    setConversationId(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const ask = async (text?: string) => {
    const t = (text ?? q).trim()
    if (!t) return
    const userMsg: Msg = { from: "user", text: t }
    const loadingMsg: Msg = { from: "genie", loading: true }
    setMsgs(prev => [...prev, userMsg, loadingMsg])
    setQ("")
    try {
      const res = await askGenie(t, conversationId ?? undefined)
      setConversationId(res.conversation_id)
      setMsgs(prev => [
        ...prev.slice(0, -1),
        { from: "genie", text: res.text, sql: res.sql, table: res.table },
      ])
    } catch (e) {
      const detail = extractError(e)
      setMsgs(prev => [
        ...prev.slice(0, -1),
        { from: "genie", text: detail, error: true },
      ])
    }
  }

  const openInGenie = (question?: string) => {
    if (!GENIE_SPACE_URL) return
    const url = question
      ? `${GENIE_SPACE_URL}?question=${encodeURIComponent(question)}`
      : GENIE_SPACE_URL
    window.open(url, "_blank", "noopener")
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(31,26,18,0.45)", backdropFilter: "blur(2px)",
        zIndex: 50, display: "flex", justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxWidth: "100%", height: "100%", background: "#fff",
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
          {msgs.length > 0 && (
            <button
              onClick={reset}
              title="Clear this conversation and start a fresh Genie thread"
              style={{
                background: "#fff", border: `1px solid ${C.line}`, color: C.ink2,
                padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                fontSize: 11, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              Reset
            </button>
          )}
          {GENIE_SPACE_URL && (
            <button onClick={() => openInGenie()} title="Open the full Genie space in a new tab" style={{
              background: "#fff", border: `1px solid ${C.line}`, color: C.ink,
              padding: "6px 10px", borderRadius: 999, cursor: "pointer",
              fontSize: 11, fontWeight: 500,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Open in Genie ↗
            </button>
          )}
          <button onClick={handleClose} style={{
            background: "transparent", border: 0, padding: 8, cursor: "pointer",
            color: C.ink2, borderRadius: 8,
          }}>
            <Icon name="x" size={18} />
          </button>
        </header>

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
                  Ask in plain English. I can pull labor, sales, and forecast data
                  for your store and region.{GENIE_SPACE_URL && " For richer analysis use Open in Genie ↗ above."}
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
                  <div key={s.q} style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => ask(s.q)}
                      style={{
                        flex: 1, textAlign: "left", background: "#fff",
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
                    {GENIE_SPACE_URL && (
                      <button
                        onClick={() => openInGenie(s.q)}
                        title="Open this question in the full Genie space"
                        style={{
                          flexShrink: 0, background: "#fff", border: `1px solid ${C.line}`,
                          padding: "0 10px", borderRadius: 12, cursor: "pointer",
                          color: C.ink2, fontSize: 14,
                        }}
                      >
                        ↗
                      </button>
                    )}
                  </div>
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
          fontSize: 13, lineHeight: 1.5, maxWidth: 360,
        }}>
          {m.text}
        </div>
      </div>
    )
  }
  const isLoading = "loading" in m
  const isError = "error" in m && m.error
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: isError ? "#9B9183" : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name="sparkle" size={14} color="#fff" />
      </div>
      <div style={{
        flex: 1, background: isError ? "#FFF1F1" : C.cream,
        borderRadius: "14px 14px 14px 4px", padding: "12px 14px", minWidth: 0,
        border: isError ? `1px solid #F5C9C9` : "none",
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
            <div style={{
              fontSize: 13, lineHeight: 1.55, color: C.ink, whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
            {!isError && m.table && <DataTable table={m.table} />}
            {!isError && m.sql && <SqlDisclosure sql={m.sql} />}
          </>
        )}
      </div>
    </div>
  )
}

function DataTable({ table }: { table: GenieTable }) {
  if (!table.columns.length || !table.rows.length) return null
  return (
    <div style={{
      marginTop: 12, background: "#fff", borderRadius: 10,
      border: `1px solid ${C.line}`, overflow: "hidden",
    }}>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          fontSize: 12, fontFamily: '"DM Mono", monospace',
        }}>
          <thead style={{ position: "sticky", top: 0, background: C.cream, zIndex: 1 }}>
            <tr>
              {table.columns.map(c => (
                <th key={c.name} style={{
                  textAlign: "left", padding: "8px 10px",
                  borderBottom: `1px solid ${C.line}`,
                  fontWeight: 600, color: C.ink2, fontSize: 10,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  fontFamily: '"DM Sans", sans-serif',
                  whiteSpace: "nowrap",
                }}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} style={{
                borderBottom: i < table.rows.length - 1 ? `1px solid ${C.line}` : "none",
              }}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: "7px 10px", color: C.ink,
                    whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {formatCell(cell, table.columns[j]?.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.truncated && (
        <div style={{
          padding: "6px 10px", fontSize: 11, color: C.ink3,
          background: C.cream, borderTop: `1px solid ${C.line}`,
        }}>
          Showing first {table.rows.length} of {table.row_count} rows.
          {GENIE_SPACE_URL && " Open in Genie for the full result."}
        </div>
      )}
    </div>
  )
}

function SqlDisclosure({ sql }: { sql: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          background: "transparent", border: 0, padding: 0, cursor: "pointer",
          color: C.ink3, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
          textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        {show ? "Hide SQL" : "Show SQL"}
        <span style={{ fontSize: 10 }}>{show ? "▾" : "▸"}</span>
      </button>
      {show && (
        <pre style={{
          marginTop: 6, padding: "10px 12px",
          background: "#1F1A12", color: "#FAF6EE",
          borderRadius: 8, fontSize: 11, lineHeight: 1.5,
          fontFamily: '"DM Mono", monospace',
          overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {sql}
        </pre>
      )}
    </div>
  )
}

function formatCell(v: unknown, type?: string): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") {
    if (type && /int|long|double|float|decimal/i.test(type)) {
      return Math.abs(v) >= 1 && Number.isInteger(v) ? v.toLocaleString("en-US") : String(v)
    }
    return String(v)
  }
  if (typeof v === "string") {
    // Genie often returns numbers as strings from the Statement API.
    if (type && /int|long|double|float|decimal/i.test(type) && /^-?\d+(\.\d+)?$/.test(v)) {
      const n = Number(v)
      return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2)
    }
    return v
  }
  return String(v)
}

function extractError(e: unknown): string {
  const err = e as { response?: { data?: { detail?: string } }; message?: string }
  const detail = err?.response?.data?.detail
  if (detail) return detail
  return err?.message ?? "Genie request failed. Check the dev server logs."
}
