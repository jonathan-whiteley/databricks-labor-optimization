import { C, theme } from "@/lib/theme"
import { Icon } from "./Icon"

// Demo data lives in the theme bundle so swapping brands swaps the table
// without code changes. When GET /api/schedule/recent ships, swap this
// component to consume that endpoint and drop the theme.recentDays field.
export function ApprovalsTable() {
  const rows = theme.recentDays
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: `1px solid ${C.line}`, overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Icon name="history" size={16} color={C.ink2} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Recent days</span>
        <span style={{ fontSize: 11, color: C.ink3 }}>· last week</span>
        <div style={{ flex: 1 }} />
        <a href="#" style={{ fontSize: 12, color: C.primary, fontWeight: 500, textDecoration: "none" }}>
          See all →
        </a>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.ink3, background: C.cream }}>
            {["Date", "Forecast", "Approved", "Δ Crew", "Δ Cost", "Reason", "Actual"].map(h => (
              <th key={h} style={{
                padding: "10px 16px", fontSize: 10,
                textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const noDeltaCrew = r.deltaCrew === "0"
            const noDeltaCost = r.deltaCost === "$0"
            return (
              <tr key={i} style={{ color: C.ink, borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "12px 16px", fontFamily: '"DM Mono", monospace', color: C.ink2 }}>{r.date}</td>
                <td style={{ padding: "12px 16px", fontFamily: '"DM Mono", monospace' }}>{r.forecast}</td>
                <td style={{ padding: "12px 16px", fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>{r.approved}</td>
                <td style={{
                  padding: "12px 16px", fontFamily: '"DM Mono", monospace',
                  color: noDeltaCrew ? C.ink3 : C.primary,
                  fontWeight: noDeltaCrew ? 400 : 600,
                }}>
                  {r.deltaCrew}
                </td>
                <td style={{
                  padding: "12px 16px", fontFamily: '"DM Mono", monospace',
                  color: noDeltaCost ? C.ink3 : C.primary,
                  fontWeight: noDeltaCost ? 400 : 600,
                }}>
                  {r.deltaCost}
                </td>
                <td style={{ padding: "12px 16px", color: r.reason === "—" ? C.ink3 : C.ink }}>
                  {r.reason}
                </td>
                <td style={{ padding: "12px 16px", fontFamily: '"DM Mono", monospace', color: C.ink2 }}>
                  {r.actual}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
