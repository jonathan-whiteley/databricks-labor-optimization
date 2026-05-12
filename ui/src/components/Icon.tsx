interface Props {
  name: string
  size?: number
  color?: string
  stroke?: number
}

const PATHS: Record<string, string> = {
  sunrise: "M3 18h18M5 18a7 7 0 0 1 14 0M12 2v4M5 9l2 2M19 9l-2 2M2 14h2M20 14h2",
  sun:     "M12 2v3M12 19v3M5 12H2M22 12h-3M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  sunset:  "M3 18h18M5 18a7 7 0 0 1 14 0M12 14V2M8 6l4-4 4 4M2 22h20",
  moon:    "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  edit:    "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z",
  check:   "M5 13l4 4 10-10",
  check2:  "M20 6L9 17l-5-5",
  arrow:   "M5 12h14M13 6l6 6-6 6",
  chevd:   "M6 9l6 6 6-6",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  sparkle: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z",
  info:    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8h.01M11 12h1v4h1",
  store:   "M3 7l1.5-4h15L21 7M3 7v13h18V7M3 7h18M9 12h6",
  user:    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  bell:    "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM10 21a2 2 0 0 0 4 0",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  trend:   "M22 7l-9 9-5-5L2 17M16 7h6v6",
  flame:   "M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-2 1-4 4-4 7a7 7 0 0 0 14 0c0-5-7-12-7-12z",
  cash:    "M2 7h20v10H2zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v6M18 9v6",
  star:    "M12 3l2.7 6.2 6.7.6-5 4.5 1.5 6.6-5.9-3.5-5.9 3.5 1.5-6.6-5-4.5 6.7-.6z",
  x:       "M18 6L6 18M6 6l12 12",
}

export function Icon({ name, size = 18, color = "currentColor", stroke = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  )
}
