// 휴게 공간에 나온 고양이(visit-cats.tsx)의 자세와 제자리, 그리고 그 고양이를
// 따라다니는 대사 상자 자리.
import type { CSSProperties } from "react"

import { CAT_HEAD } from "@/kttn/kttn-draw"
import { PIXEL_SCALE } from "@/kttn/pixel"
import type { VisitAction } from "@/kttn/props-catalog"
import type { CatPose } from "@/kttn/sprites"
import { SIT_OFFSET } from "@/lib/desk-layout"

export type Action = VisitAction | "perch"

export const POSE: Record<Action, CatPose> = {
  eat: "eat",
  nap: "curl",
  groove: "hum",
  play: "play",
  perch: "curl",
}

// 캣타워(20×29) 층마다 고양이가 엎드리는 자리. 발밑 가운데(논리 픽셀)다.
export const PERCHES = [
  { x: 10, y: 6 },
  { x: 9, y: 17 },
]

// 휴게 공간에서 제자리. 자는 고양이는 소품 위 가운데, 캣타워에서는 층 위,
// 나머지는 소품 왼쪽 옆 바닥에 선다. transform은 걷는 동안 옮기는 데 쓴다.
export function placeFor(action: Action, perch: number): CSSProperties {
  if (action === "perch") {
    const at = PERCHES[perch]
    return {
      left: (at.x - 8) * PIXEL_SCALE,
      top: (at.y - 16) * PIXEL_SCALE,
    }
  }
  if (action === "nap")
    return { left: "50%", bottom: "35%", marginLeft: -8 * PIXEL_SCALE }
  return { left: -12 * PIXEL_SCALE, bottom: 0 }
}

// 이 고양이의 대사 상자를 휴게 공간의 고양이 머리 위로 옮긴다. 상자는 책상
// 구역 기준 백분율 자리라 그 바깥(100% 넘게)으로도 놓인다.
export function follow(
  key: string,
  cat: DOMRect,
  ratio: number,
  /** 머리가 낮은 자세(둥글게 만 잠)에서 상자를 내리는 만큼(논리 px) */
  drop = 0
) {
  const speech = document.querySelector<HTMLElement>(
    `[data-speech-for="${CSS.escape(key)}"]`
  )
  const box = speech?.parentElement?.getBoundingClientRect()
  if (!speech || !box?.width || !box.height) return
  const x = cat.left + cat.width / 2
  const y = cat.bottom - (SIT_OFFSET + CAT_HEAD - drop) * PIXEL_SCALE * ratio
  speech.style.left = `${((x - box.left) / box.width) * 100}%`
  speech.style.top = `${((y - box.top) / box.height) * 100}%`
  speech.style.zIndex = "45"
}
