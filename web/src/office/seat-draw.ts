// 자유 자리(방석, 빈백, 소파, 창턱 등) 그리기. 그림 한 칸에 가구와 고양이가
// 함께 있다(sprite-art/seats.ts). 털·그늘·눈·넥타이(f·s·e·t)는 고양이마다
// 칠하고, 기기 화면 "!"는 책상 모니터 LED와 같은 색(ledColor)으로 칠한다.
import type { AgentState } from "@/lib/agent-office"
import { catOnly, seatKindFor, type SeatFrame } from "@/lib/agent-office-seats"
import { ledColor, type OfficeLayout } from "@/office/office-draw"
import { seatPoint } from "@/lib/desk-layout"
import { rect } from "@/office/pixel"
import { catPalette, sheetCanvas } from "@/office/sprites"
import { SEATS, type Grid } from "@/office/sprite-data"

/** 자리 그림 하나. anchor는 고양이 발밑 아래 가운데, head는 머리 꼭대기 가운데다. */
export type SeatArt = {
  anchor: { x: number; y: number }
  head: { x: number; y: number }
  frames: Record<SeatFrame, Grid>
}

const SCREEN = "!"
/** 꺼진 화면(상태가 없거나 고양이가 자리를 비움) */
const SCREEN_OFF = "#1f2937"

type SeatImage = { canvas: HTMLCanvasElement; screen: [number, number][] }
const cache = new Map<string, SeatImage>()

// 칸 하나를 칠한 그림과 화면("!") 자리. lifted면 고양이만 남긴다(catOnly,
// 고양이만 폴짝 뛸 때 가구 위에 겹쳐 그린다).
function seatImage(
  name: string,
  art: SeatArt,
  frame: SeatFrame,
  coat: number,
  tie: string,
  lifted = false
) {
  const key = `${name}|${frame}|${coat}|${tie}|${lifted}`
  let hit = cache.get(key)
  if (!hit) {
    const full = art.frames[frame]
    const screen: [number, number][] = []
    full.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === SCREEN) screen.push([x, y])
    })
    const grid = lifted ? catOnly(full, art.frames.empty) : full
    hit = { canvas: sheetCanvas([grid], catPalette(coat, tie)), screen }
    cache.set(key, hit)
  }
  return hit
}

/**
 * 자리 하나를 그린다. (x, y)는 고양이 발밑 가운데(책상 고양이와 같은 곳)다.
 * frame이 empty면 고양이 없이 가구와 꺼진 기기만 그린다. lift만큼 고양이만
 * 들어 올린다(확인을 기다리는 폴짝). 가구와 화면은 제자리에 있다.
 */
export function drawSeat(
  ctx: CanvasRenderingContext2D,
  name: string,
  art: SeatArt,
  frame: SeatFrame,
  x: number,
  y: number,
  coat: number,
  tie: string,
  state: AgentState | null,
  t: number,
  lift = 0
) {
  const left = Math.round(x - art.anchor.x)
  const top = Math.round(y - art.anchor.y)
  ctx.imageSmoothingEnabled = false
  const { canvas, screen } = seatImage(name, art, frame, coat, tie)
  if (lift > 0) {
    ctx.drawImage(seatImage(name, art, "empty", coat, tie).canvas, left, top)
    ctx.drawImage(
      seatImage(name, art, frame, coat, tie, true).canvas,
      left,
      top - lift
    )
  } else ctx.drawImage(canvas, left, top)
  const led = (frame !== "empty" && ledColor(state, t)) || SCREEN_OFF
  // 고양이가 안고 있는 기기(빈 자리에서는 다른 곳에 놓인 화면)는 함께 든다.
  const empty = art.frames.empty
  for (const [sx, sy] of screen) {
    const up = lift > 0 && empty[sy]?.[sx] !== SCREEN ? lift : 0
    rect(ctx, left + sx, top + sy - up, 1, 1, led)
  }
}

/** 발밑에서 머리 꼭대기까지의 높이(대사 꼬리 자리) */
export const seatHeadRise = (art: SeatArt) => art.anchor.y - art.head.y
/** 발밑 가운데에서 머리 가운데까지 가로로 떨어진 거리(옆으로 엎드린 자리 등) */
export const seatHeadShift = (art: SeatArt) => art.head.x - art.anchor.x


/** 이 고양이의 자유 자리(이름과 그림). 책상에 앉으면 null이다. */
export function seatOf(key: string) {
  const name = seatKindFor(key, Object.keys(SEATS))
  return name ? { name, art: SEATS[name as keyof typeof SEATS] as SeatArt } : null
}

/**
 * 자유 자리 그림이 놓이는 상자(책상 구역 좌표). 누르는 자리, 이름표,
 * 새끼 고양이가 이 상자를 기준으로 선다. 책상에 앉으면 null이다.
 */
export function seatBox(layout: OfficeLayout, index: number, key: string) {
  const seat = seatOf(key)
  if (!seat) return null
  const at = seatPoint(layout, index)
  const grid = seat.art.frames.idle
  const w = grid[0]?.length ?? 0
  const h = grid.length
  const x = at.x - seat.art.anchor.x
  const y = at.y - seat.art.anchor.y
  return { x, y, w, h, cx: x + w / 2, bottom: y + h }
}
