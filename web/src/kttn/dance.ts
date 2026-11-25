import { useEffect } from "react"

import { typing } from "@/kttn/butler-controls"
import { pressSecret } from "@/lib/kttn-dance"

// 비밀 키를 누르면 이만큼(ms) 모든 고양이가 춤춘다. 그림판(kttn-canvas.tsx)은
// dancing()으로 지금 춤출 때인지 본다.
const DANCE_MS = 8_000

let until = 0

/** 지금 춤출 때인지(줄임 동작이면 춤추지 않는다) */
export const dancing = (t: number) => t < until

/** 비밀 키를 듣는다. kttn 화면에 한 번 둔다. */
export function useDanceKeys() {
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let matched = 0
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typing(event.target)) return
      const result = pressSecret(matched, event.key)
      matched = result.matched
      if (result.done && !still) until = Date.now() + DANCE_MS
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])
}
