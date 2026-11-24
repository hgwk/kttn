import { useEffect, useSyncExternalStore } from "react"

import { NEAR_PX, typing } from "@/office/butler-controls"

// 집사의 쓰다듬기. 집사가 고양이 곁에 서 있으면 스페이스로 쓰다듬는다(곁인지는
// butler-controls.ts의 nearestSpeech와 같은 거리로, 누른 순간 다시 잰다. 고양이도
// 걸어 다니므로 집사가 걸을 때 달아 둔 data-near는 늦을 수 있다). 고양이 머리 위로 도트 하트가
// 떠오르고, 오늘 쓰다듬은 횟수를 이 브라우저에 남긴다(하루가 바뀌면 0부터).

const STORE = "kttn.pets"
const listeners = new Set<() => void>()
let cached: { day: string; n: number } | null = null

const today = () => new Date().toLocaleDateString("sv")

function read() {
  if (cached?.day === today()) return cached
  // 저장된 값은 손으로 고치거나 다른 판이 남겼을 수 있으므로 모양을 확인한다
  // ("null"이나 숫자가 아닌 n이면 0부터).
  let saved: { day?: unknown; n?: unknown } = {}
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORE) ?? "{}")
    if (value && typeof value === "object") saved = value
  } catch {
    // 저장소를 못 쓰면 이 탭에서만 센다.
  }
  const n = saved.n
  const valid = typeof n === "number" && Number.isInteger(n) && n >= 0
  cached = { day: today(), n: saved.day === today() && valid ? n : 0 }
  return cached
}

function bump() {
  // 다른 탭이 센 것까지 이어 세도록 저장소에서 다시 읽는다.
  cached = null
  const next = { day: today(), n: read().n + 1 }
  cached = next
  try {
    localStorage.setItem(STORE, JSON.stringify(next))
  } catch {
    // 저장소를 못 쓰면 이 탭에서만 센다.
  }
  for (const listener of listeners) listener()
}

const BUTTONS = "button, a, [role=button]"

// 7×6 도트 하트(1이 칠한 칸)
const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"]
const DOT = 3

/**
 * 고양이 머리 위로 도트 하트를 띄운다. 대사 상자(아래 끝이 고양이 머리)에
 * 붙여 화면이 스크롤되거나 고양이가 걸어도 같이 움직인다.
 */
function heart(speech: Element) {
  const box = document.createElement("div")
  box.setAttribute("aria-hidden", "true")
  box.dataset.petHeart = ""
  Object.assign(box.style, {
    position: "absolute",
    left: "50%",
    top: `calc(100% - ${2 * DOT}px)`,
    marginLeft: `${-(7 * DOT) / 2}px`,
    width: `${7 * DOT}px`,
    height: `${6 * DOT}px`,
    pointerEvents: "none",
    zIndex: "90",
  })
  HEART.forEach((row, r) =>
    [...row].forEach((cell, c) => {
      if (cell !== "1") return
      const dot = document.createElement("div")
      Object.assign(dot.style, {
        position: "absolute",
        left: `${c * DOT}px`,
        top: `${r * DOT}px`,
        width: `${DOT}px`,
        height: `${DOT}px`,
        background: r === 1 && c === 1 ? "#fecdd3" : "#e11d48",
      })
      box.append(dot)
    })
  )
  speech.append(box)
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (still) {
    window.setTimeout(() => box.remove(), 700)
    return
  }
  box
    .animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(-24px)", opacity: 0 },
      ],
      { duration: 900, easing: "steps(6)" }
    )
    .finished.finally(() => box.remove())
}

/** 집사 곁(NEAR_PX 안)에서 가장 가까운 고양이의 대사 상자. 없으면 null. */
function nearCat() {
  const butler = document.querySelector<HTMLElement>("[data-butler]")
  if (!butler) return null
  const b = butler.getBoundingClientRect()
  // 화면 배율(확대, 축소). 겉보기 폭과 원래 폭의 비율이다.
  const scale = b.width / (butler.offsetWidth || b.width) || 1
  const x = b.left + b.width / 2
  const y = b.top + b.height / 2
  let best: HTMLElement | null = null
  let bestDistance = NEAR_PX * scale
  for (const speech of document.querySelectorAll<HTMLElement>(
    "[data-cat-speech]"
  )) {
    // 숨긴 상자(만남 중인 쪽)와 퇴근한 고양이(빈 책상)는 뺀다.
    if (speech.hidden || speech.dataset.ended !== undefined) continue
    // 대사 상자 아래 끝이 고양이 머리라 그보다 조금 아래를 고양이 자리로 본다.
    const r = speech.getBoundingClientRect()
    const distance = Math.hypot(
      r.left + r.width / 2 - x,
      r.bottom + 16 * scale - y
    )
    if (distance < bestDistance) {
      best = speech
      bestDistance = distance
    }
  }
  return best
}

/**
 * 스페이스로 집사 곁 고양이를 쓰다듬게 하고, 오늘 쓰다듬은 횟수를 돌려준다.
 * 곁에 고양이가 없으면 스페이스는 원래대로 둔다.
 */
export function usePetting() {
  useEffect(() => {
    // 마우스로 누른 버튼. 그 버튼에 남은 포커스는 키보드로 간 것이 아니다.
    let clicked: Element | null = null
    const down = (event: KeyboardEvent) => {
      // Tab으로 포커스를 옮기면 그다음 버튼은 키보드로 간 것이다.
      if (event.key === "Tab") clicked = null
      if (event.key !== " " || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typing(event.target)) return
      // 키보드(Tab)로 버튼(책상, 말풍선 등)에 가 있으면 스페이스는 그 버튼을
      // 누른다. 마우스로 누른 버튼에 남은 포커스(Chrome)에서는 쓰다듬는다.
      // :focus-visible로는 못 가른다(Chrome은 키를 누르는 순간 참으로 바꾼다).
      const target = event.target as Element | null
      const focused = target?.closest?.(BUTTONS)
      if (focused && focused !== clicked) return
      const speech = nearCat()
      if (!speech) return
      event.preventDefault()
      heart(speech)
      bump()
    }
    const point = (event: PointerEvent) => {
      clicked = (event.target as Element | null)?.closest?.(BUTTONS) ?? null
    }
    window.addEventListener("pointerdown", point, true)
    window.addEventListener("keydown", down)
    return () => {
      window.removeEventListener("pointerdown", point, true)
      window.removeEventListener("keydown", down)
    }
  }, [])
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => read().n,
    () => 0
  )
}
