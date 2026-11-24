// 집사의 조작과 그림: 걷는 빠르기, 이동 키, 걸음 그림 한 장.
import { t } from "@/i18n"
import { BUTLER_FRAMES, BUTLER_PALETTE } from "@/office/butler-sprite"
import { boxIn } from "@/office/butler-walk"
import { actionError } from "@/office/cat-actions"
import { OFFICE_SCALE } from "@/office/pixel"

export type Dir = "front" | "back" | "left" | "right"

export const SIZE = 16 * OFFICE_SCALE
// 걷는 빠르기(안쪽 좌표 px/초)와 걸음 그림 간격(ms)
export const WALK_SPEED = 260
// 키를 톡 눌렀을 때 걷는 시간(초). 약 9px이다.
export const TAP_S = 1 / 30
export const STEP_MS = 140
// 고양이와 이만큼(안쪽 좌표 px) 가까우면 그 고양이의 대사를 펼친다.
export const NEAR_PX = 64

export const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
}

/** 글을 쓰는 중인 입력칸에서는 키를 가로채지 않는다. */
export function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

// 네 방향 × 네 걸음 그림을 한 장에 그려 둔다.
export function sheet() {
  const canvas = document.createElement("canvas")
  canvas.width = 16 * 4
  canvas.height = 16 * 3
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  ;(["front", "back", "side"] as const).forEach((name, row) =>
    BUTLER_FRAMES[name].forEach((grid, col) =>
      grid.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const color = BUTLER_PALETTE[line[x]]
          if (!color) continue
          ctx.fillStyle = color
          ctx.fillRect(col * 16 + x, row * 16 + y, 1, 1)
        }
      })
    )
  )
  return canvas
}

/** 걸어가는 쪽을 보는 방향. 가로로 더 멀면 옆, 아니면 앞뒤를 본다. */
export function facing(from: { x: number; y: number }, to: { x: number; y: number }): Dir {
  if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y))
    return to.x < from.x ? "left" : "right"
  return to.y < from.y ? "back" : "front"
}

/**
 * 집사와 가장 가까운 고양이의 대사 상자. 상자 아래 끝이 고양이 머리라 그보다
 * 조금 아래를 고양이 자리로 본다. NEAR_PX 안에 없으면 null.
 */
export function nearestSpeech(
  floor: HTMLElement,
  pos: { x: number; y: number },
  scale: number
) {
  let best: Element | null = null
  let bestDistance = NEAR_PX
  for (const speech of floor.querySelectorAll("[data-cat-speech]")) {
    const r = boxIn(speech, floor, scale)
    const distance = Math.hypot((r.l + r.r) / 2 - pos.x, r.b + 16 - (pos.y - SIZE / 2))
    if (distance < bestDistance) {
      best = speech
      bestDistance = distance
    }
  }
  return best
}

/** 세션의 터미널 탭을 앞으로 띄워 달라고 한다. 집사가 머리 위에 말할 글을 준다. */
export async function focusSession(key: string) {
  try {
    const response = await fetch("/api/focus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    })
    return response.ok ? t("butler.opened") : actionError(response.status)
  } catch {
    return t("butler.openFailed")
  }
}
