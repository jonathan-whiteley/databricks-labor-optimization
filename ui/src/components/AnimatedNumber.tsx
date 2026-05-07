import { useEffect, useRef, useState } from "react"

interface Props {
  value: number
  format?: (n: number) => string
  durationMs?: number
}

export function AnimatedNumber({ value, format = n => n.toLocaleString(), durationMs = 350 }: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = performance.now()
    cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const cur = fromRef.current + (value - fromRef.current) * eased
      setDisplay(cur)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <span className="tabular">{format(display)}</span>
}
