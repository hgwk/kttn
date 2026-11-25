// 책상 구역에서 고양이가 걸을 수 있는 곳과 가는 곳. 책상과 의자, 자유 자리
// 가구는 막고, 책상 옆 샛길과 줄 아래 통로는 싸게 쳐서 예전 길 모양을 살린다.
// 앉은 자리에서는 오른쪽으로만 나선다(책상 뒤로 옆걸음해 샛길로 나간다).
import {
  DESK_GAP_X,
  seatFor,
  seatPoint,
  type DeskLayout,
} from "./desk-layout.ts"
import {
  clampToBox,
  makeGrid,
  type Box,
  type Grid,
  type Point,
} from "./walk-grid.ts"

// 책상 오른쪽 옆 샛길. 책상 오른쪽 끝(자리 x+15)과 이웃 책상 왼쪽 끝
// (x+간격-15) 사이 한가운데라 고양이(폭 16)가 어느 책상에도 걸치지 않는다.
export const AISLE_DX = DESK_GAP_X / 2
// 줄 아래 통로. 이름표(자리 y+21~30) 아래, 다음 줄 말풍선 위를 지난다.
export const LANE_DY = 44
// 고양이 몸 반폭과 키(발밑 위로). 막는 상자를 이만큼 넓혀 몸이 겹치지 않게 한다.
const HALF_W = 8
const BODY_H = 16

/** 자유 자리 가구 그림이 차지하는 상자(왼쪽 위 x, y와 크기) */
export type SeatBox = { x: number; y: number; w: number; h: number }

/**
 * 발밑이 있을 수 있는 범위. 몸(폭 16, 키 16)이 책상 구역 밖으로 나가지 않는다.
 * 문(왼쪽 위)도 이 안이다.
 */
export const walkBounds = (layout: DeskLayout): Box => ({
  l: HALF_W,
  t: BODY_H,
  r: layout.w - HALF_W,
  b: layout.h - 2,
})

// 막는 상자에서 앉은 자리 줄(발밑 높이 ±1)의 자리 오른쪽만 비운다. 앉은
// 고양이는 이 틈으로 오른쪽 샛길까지 옆걸음해 나가고 들어온다.
function slotted(outer: Box, seat: Point): Box[] {
  return [
    { l: outer.l, t: outer.t, r: outer.r, b: seat.y - 1 },
    { l: outer.l, t: seat.y + 1, r: outer.r, b: outer.b },
    { l: outer.l, t: seat.y - 2, r: seat.x - 1, b: seat.y + 2 },
  ]
}

/**
 * 자리마다 막는 상자. 책상 자리는 의자 위끝(y-6)부터 책상 아래끝(y+18)에 몸
 * 키를 더한 곳까지, 자유 자리는 가구 그림 상자에 몸 키를 더한 곳까지다.
 */
export function deskBlocks(
  layout: DeskLayout,
  count: number,
  free: (SeatBox | null)[] = []
): Box[] {
  const blocks: Box[] = []
  for (let index = 0; index < count; index++) {
    const seat = seatPoint(layout, index)
    const box = free[index]
    const desk = seatFor(layout, index)
    const outer = box
      ? {
          l: box.x - HALF_W,
          t: box.y - 2,
          r: box.x + box.w + HALF_W,
          b: box.y + box.h + BODY_H,
        }
      : {
          l: desk.x - 16 - HALF_W,
          t: desk.y - 6,
          r: desk.x + 16 + HALF_W,
          b: desk.y + 18 + BODY_H,
        }
    blocks.push(...slotted(outer, seat))
  }
  return blocks
}

/** 책상 구역의 걷는 격자. 자리 수(count)와 자유 자리 상자(free)에 따른다. */
export function deskGrid(
  layout: DeskLayout,
  count: number,
  free: (SeatBox | null)[] = []
): Grid {
  const aisles = Array.from(
    { length: layout.cols },
    (_, col) => seatFor(layout, col).x + AISLE_DX
  )
  const lanes = Array.from(
    { length: layout.rows },
    (_, row) => seatFor(layout, row * layout.cols).y + LANE_DY
  )
  return makeGrid(
    walkBounds(layout),
    deskBlocks(layout, count, free),
    [layout.door.x, ...aisles],
    lanes
  )
}

const inside = (layout: DeskLayout, p: Point) =>
  clampToBox(walkBounds(layout), p)

/** 다른 자리(to) 오른쪽 샛길, 앉은 고양이 곁에 서는 곳 */
export function standBeside(layout: DeskLayout, to: number): Point {
  const seat = seatPoint(layout, to)
  return inside(layout, { x: seatFor(layout, to).x + AISLE_DX, y: seat.y })
}

/** 산책 끝. 줄 아래 통로를 따라 책상 왼쪽까지 간다. */
export function strollPoint(layout: DeskLayout, index: number): Point {
  const desk = seatFor(layout, index)
  return inside(layout, { x: desk.x - 20, y: desk.y + LANE_DY })
}

/**
 * 휴게 공간 입구. 책상 구역 아래 끝, 그 자리 샛길 밑이다. 캣타워나 소품에
 * 가는 고양이는 여기까지 걸어와 사라지고 휴게 공간(visit-cats.tsx)에서 이어
 * 걷는다.
 */
export function loungeExit(layout: DeskLayout, index: number): Point {
  const aisle = seatFor(layout, index).x + AISLE_DX
  return inside(layout, { x: aisle, y: layout.h - 2 })
}
