// 폴더 방 하나의 책상 구역 그리기. 바닥과 벽은 방(HTML)이 타일 배경으로 깔고,
// 캔버스는 투명 바탕에 책상·의자·고양이만 그린다. 논리 해상도로 그린 뒤 CSS로
// 확대하므로 좌표는 모두 정수 픽셀이다. 상태 판단은 하지 않는다.
import type { AgentState } from "@/lib/kttn"
import { PIXEL_SCALE, rect } from "@/kttn/pixel"
import {
  coatFor,
  drawKitten,
  drawSmokePuff,
  drawItem,
  type CatPose,
} from "@/kttn/sprites"

export { PIXEL_SCALE } from "@/kttn/pixel"

export {
  CAT_DX,
  CAT_HEAD,
  DESK_GAP_X,
  MAX_DESKS,
  deskLayout,
  seatFor,
  type DeskLayout,
} from "@/lib/desk-layout"
import {
  CAT_DX,
  DESK_GAP_X,
  seatFor,
  type DeskLayout,
} from "@/lib/desk-layout"

const FAMILY_COLORS: Record<string, string> = {
  claude: "#ff8709",
  codex: "#3b82f6",
}

export function familyColor(family: string) {
  return FAMILY_COLORS[family] ?? "#8b5cf6"
}

/** 화면 너비(px)에 책상이 몇 열까지 들어가는지. 방 너비에 맞춰 열을 고른다. */
export function colsForWidth(px: number) {
  const logical = px / PIXEL_SCALE
  return Math.max(1, Math.floor((logical - 86) / DESK_GAP_X) + 1)
}

export function drawRoom(ctx: CanvasRenderingContext2D, layout: DeskLayout) {
  // 출입문은 방 틀(RoomFrame)의 아래 벽에 뚫려 있어 바닥만 비운다.
  ctx.clearRect(0, 0, layout.w, layout.h)
}

export function drawChair(
  ctx: CanvasRenderingContext2D,
  layout: DeskLayout,
  index: number
) {
  const { x, y } = seatFor(layout, index)
  drawItem(ctx, "chair", x + CAT_DX - 7, y - 5)
}

export function drawDesk(
  ctx: CanvasRenderingContext2D,
  layout: DeskLayout,
  index: number,
  state: AgentState | null,
  t: number
) {
  const { x, y } = seatFor(layout, index)
  drawItem(ctx, "desk", x - 16, y + 4)
  drawItem(ctx, "keyboard", x + CAT_DX - 6, y + 6)
  drawMonitorBack(ctx, x - 16, y - 2, ledColor(state, t))
}

// 모니터는 고양이 쪽을 보고 있어 보는 사람에게는 뒷면이 보인다. 뒷면 그림 위에
// 상태 LED만 찍는다.
function drawMonitorBack(
  ctx: CanvasRenderingContext2D,
  mx: number,
  my: number,
  led: string | null
) {
  drawItem(ctx, "monitorBack", mx, my)
  if (led) rect(ctx, mx + 13, my + 8, 2, 1, led)
}

// 뒷면 LED로 하는 일을 보인다. 확인 필요와 명령 실행은 깜빡인다.
export function ledColor(state: AgentState | null, t: number) {
  const blink = Math.floor(t / 350) % 2 === 0
  switch (state) {
    case "editing":
    case "working":
      return "#22c55e"
    case "running":
      return blink ? "#22c55e" : "#14532d"
    case "reading":
    case "browsing":
      return "#38bdf8"
    case "needs_you":
      return blink ? "#f59e0b" : "#78350f"
    case "thinking":
    case "delegating":
      return "#a78bfa"
    default:
      return null
  }
}

const TYPING = new Set<AgentState>([
  "editing",
  "running",
  "working",
  "browsing",
])

/** 자리에 앉은 고양이의 자세. 초상화도 같은 자세를 쓴다. */
export function poseFor(state: AgentState): CatPose {
  if (state === "sleeping") return "sleep"
  if (state === "needs_you") return "alert"
  return TYPING.has(state) ? "type" : "sit"
}

/** 하위 에이전트는 책상 옆 새끼 고양이로 보인다. 부모 자세를 따라 한다. */
export function drawMinions(
  ctx: CanvasRenderingContext2D,
  layout: DeskLayout,
  index: number,
  count: number,
  tie: string,
  key: string,
  t: number,
  /** 자유 자리 그림 상자. 있으면 그 양옆 바닥에 선다. */
  seat?: { cx: number; w: number; bottom: number } | null,
  /** 부모 고양이 자세(새끼도 따라 자판을 치거나 자거나 놀란다) */
  pose: CatPose = "type"
) {
  const { x, y } = seatFor(layout, index)
  // 새끼 고양이는 10px라 책상 양옆에 11px 간격으로 둘씩 선다.
  for (let i = 0; i < Math.min(count, 4); i++) {
    const side = i % 2 === 0 ? -1 : 1
    const step = Math.floor(i / 2) * 11
    const mx = seat
      ? seat.cx + side * (seat.w / 2 + 6 + step)
      : x + CAT_DX + side * (22 + step) - (side < 0 ? 6 : 0)
    const my = seat ? seat.bottom : y + 20
    drawKitten(ctx, mx, my, coatFor(`${key}:${i}`), tie, t + i * 90, pose)
  }
}

/**
 * 도구가 실패한 고양이 모니터에서 피어오르는 연기(sprite-art의 SMOKE).
 * (x, y)는 고양이 발밑 가운데다. 머리 위는 대사 상자가 덮으므로 왼쪽 모니터
 * 위에서 오른다.
 */
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number
) {
  drawSmokePuff(ctx, x - 18, y - 8, t)
}

/** 할 일을 끝낸 고양이 옆에 찍히는 초록 체크 도장. (x, y)는 발밑 가운데다. */
export function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const left = Math.round(x + 7)
  const top = Math.round(y - 19)
  rect(ctx, left, top, 9, 9, "#14532d")
  rect(ctx, left + 1, top + 1, 7, 7, "#4ade80")
  // 체크 모양(짧은 획 + 긴 획)
  rect(ctx, left + 2, top + 4, 1, 1, "#14532d")
  rect(ctx, left + 3, top + 5, 1, 1, "#14532d")
  rect(ctx, left + 4, top + 4, 1, 1, "#14532d")
  rect(ctx, left + 5, top + 3, 1, 1, "#14532d")
  rect(ctx, left + 6, top + 2, 1, 1, "#14532d")
}
