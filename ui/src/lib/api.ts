import axios from "axios"

export const api = axios.create({ baseURL: "/api" })

export type Store = { store_id: number; store_name: string; region: string; state: string }
export type DayPartForecast = { day_part: string; predicted_revenue: number; predicted_transactions: number }
export type ForecastResponse = { store_id: number; forecast_date: string; day_parts: DayPartForecast[] }
export type RoleMix = { cook: number; cashier: number; shift_lead: number; manager: number }
export type DayPartRec = {
  day_part: string
  recommended_headcount: number
  recommended_cost: number
  recommended_role_mix: RoleMix
}
export type RecommendationResponse = {
  store_id: number
  forecast_date: string
  generated_ts: string
  day_parts: DayPartRec[]
}

export const listStores = () => api.get<Store[]>("/stores").then(r => r.data)
export const getForecast = (s: number, d: string) =>
  api.get<ForecastResponse>(`/forecast/${s}/${d}`).then(r => r.data)
export const getRecommendation = (s: number, d: string) =>
  api.get<RecommendationResponse>(`/recommendation/${s}/${d}`).then(r => r.data)
export const recompute = (body: { store_id: number; day_part: string; projected_sales: number }) =>
  api.post<DayPartRec>("/recommendation/recompute", body).then(r => r.data)
export const saveSchedule = (body: object) =>
  api.post<{ schedule_ids: number[] }>("/schedule/save", body).then(r => r.data)
