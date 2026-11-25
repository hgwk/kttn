// 자유 자리(방석, 빈백, 소파, 창턱 등) 그리기. 그림 한 칸에 가구와 고양이가
// 함께 있다(sprite-art/seats.ts). 털·그늘·눈·넥타이(f·s·e·t)는 고양이마다
// 칠하고, 기기 화면 "!"는 책상 모니터 LED와 같은 색(ledColor)으로 칠한다.
import type { AgentState } from "@/lib/agent-office"
import type { SeatFrame } from "@/lib/agent-office-seats"
import { ledColor } from "@/office/office-draw"
import { rect } from "@/office/pixel"
import { catPalette, sheetCanvas } from "@/office/sprites"
import type { Grid } from "@/office/sprite-data"

/** 자리 그림 하나. anchor는 고양이 발밑 아래 가운데, head는 머리 꼭대기 가운데다. */
export type SeatArt = {
  anchor: { x: number; y: number }
  head: { x: number; y: number }
  frames: Record<SeatFrame, Grid>
}

const SCREEN = "!"
/** 꺼진 화면(상태가 없거나 고양이가 자리를 비움) */
const SCREEN_OFF = "#1f2937"

const cache = new Map<string, { canvas: HTMLCanvasElement; screen: [number, number][] }>()

function seatImage(name: string, art: SeatArt, frame: SeatFrame, coat: number, tie: string) {
  const key = `${name}|${frame}|${coat}|${tie}`
  let hit = cache.get(key)
  if (!hit) {
    const grid = art.frames[frame]
    const screen: [number, number][] = []
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === SCREEN) screen.push([x, y])
    })
    hit = { canvas: sheetCanvas([grid], catPalette(coat, tie)), screen }
    cache.set(key, hit)
  }
  return hit
}

/**
 * 자리 하나를 그린다. (x, y)는 고양이 발밑 가운데(책상 고양이와 같은 곳)다.
 * frame이 empty면 고양이 없이 가구와 꺼진 기기만 그린다.
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
  t: number
) {
  const { canvas, screen } = seatImage(name, art, frame, coat, tie)
  const left = Math.round(x - art.anchor.x)
  const top = Math.round(y - art.anchor.y)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, left, top)
  const led = (frame !== "empty" && ledColor(state, t)) || SCREEN_OFF
  for (const [sx, sy] of screen) rect(ctx, left + sx, top + sy, 1, 1, led)
}

/** 발밑에서 머리 꼭대기까지의 높이(대사 꼬리 자리) */
export const seatHeadRise = (art: SeatArt) => art.anchor.y - art.head.y

/**
 * 자유 자리 그림들. 그림 정본은 sprite-art/seats.ts(e3)이며, 아직 없으면 비어
 * 있어 모든 고양이가 책상에 앉는다.
 */
export const SEATS: Record<string, SeatArt> = {}
