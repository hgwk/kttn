

import { useEffect, useRef } from "react"

type Draw<T> = (
  ctx: CanvasRenderingContext2D,
  data: T,
  dt: number,
  t: number,
  still: boolean
) => void

/**
 * 픽셀 그림의 그리기 반복. 최신 자료와 그리기 함수는 ref로 들고 있어
 * 자료가 바뀌어도 반복을 다시 만들지 않는다. 움직임을 줄인 환경에서는
 * 애니메이션 없이 2초마다 한 번 다시 그린다. 화면 밖(스크롤에 가린 방)에
 * 있는 동안은 그리지 않고, 다시 보이면 이어서 그린다.
 */
export function usePixelLoop<T>(data: T, draw: Draw<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ data, draw })

  useEffect(() => {
    latest.current = { data, draw }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let frame = 0
    let last = performance.now()
    let visible = true

    const render = (now: number) => {
      frame = 0
      const dt = Math.min(now - last, 100)
      last = now
      const { data: current, draw: paint } = latest.current
      paint(ctx, current, dt, still ? 0 : Date.now(), still)
      if (!still && visible) frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    const redraw = still
      ? window.setInterval(() => render(performance.now()), 2000)
      : 0
    const watch = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !still && !frame) {
        last = performance.now()
        frame = requestAnimationFrame(render)
      }
    })
    watch.observe(canvas)
    return () => {
      watch.disconnect()
      cancelAnimationFrame(frame)
      if (redraw) window.clearInterval(redraw)
    }
  }, [])

  return canvasRef
}
