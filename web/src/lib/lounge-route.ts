// 휴게 공간에 나온 고양이의 길과 제자리. 화면을 모르는 순수 계산이다. 화면
// 쪽(kttn/lounge-walk.ts)이 휴게 공간과 소품 상자를 재서 넘긴다. 좌표는 고양이가
// 원래 설 제자리 발밑(home)을 (0, 0)으로 둔 확대 전 화면 px다.
import {
  clampToBox,
  isFree,
  makeGrid,
  route,
  settle,
  type Box,
  type Grid,
  type Point,
} from "./walk-grid.ts"

// 고양이 몸 반폭(화면 px, 확대 전, 논리 8px × 2)과 격자 한 칸
export const LOUNGE_HALF = 16
const CELL = 4
// 제자리가 막혔을 때 같은 높이에서 옆으로 찾아보는 칸 수
const SIDE_STEPS = 12

/**
 * 휴게 공간의 걷는 격자. 소품(props, 찾아가는 소품은 빼고 넘긴다)은 몸 폭만큼
 * 좌우로 넓히고 앞(아래)으로 발 한 칸만 더 막는다. 위쪽은 문(책상 구역 아래 끝,
 * 휴게 공간 위 틈 너머)까지 걷는다.
 */
export function loungeGrid(room: Box, props: Box[], door: Point): Grid {
  const bounds = {
    l: room.l + LOUNGE_HALF,
    t: Math.min(room.t, door.y),
    r: room.r - LOUNGE_HALF,
    b: room.b,
  }
  const blocks = props.map((box) => ({
    l: box.l - LOUNGE_HALF,
    t: box.t,
    r: box.r + LOUNGE_HALF,
    b: box.b + CELL,
  }))
  return makeGrid(bounds, blocks, [], [], CELL)
}

/**
 * 고양이가 실제로 설 자리. 원래 제자리(home)가 방 벽에 걸치거나 이웃 소품에
 * 몸이 겹치면, 같은 높이에서 옆으로 가장 가까운 빈 칸으로 옮긴다. 옆에 없으면
 * 가장 가까운 걸을 수 있는 칸이다.
 */
export function restSpot(grid: Grid, home: Point): Point {
  const inside = clampToBox(grid.bounds, home)
  if (isFree(grid, inside)) return inside
  for (let k = 1; k <= SIDE_STEPS; k++)
    for (const side of [1, -1]) {
      const p = { x: inside.x + side * k * grid.cell, y: inside.y }
      if (p.x >= grid.bounds.l && p.x <= grid.bounds.r && isFree(grid, p))
        return p
    }
  return settle(grid, inside)
}

/**
 * 문에서 제자리까지의 꺾은선(첫 점은 문, 마지막 점은 설 자리)과 설 자리. 길을
 * 못 찾으면 예전처럼 세로로 내려온 뒤 가로로 간다(fallback).
 */
export function loungeRoute(
  room: Box,
  props: Box[],
  door: Point,
  home: Point = { x: 0, y: 0 }
) {
  const grid = loungeGrid(room, props, door)
  const rest =
    grid.bounds.r > grid.bounds.l && grid.bounds.b > grid.bounds.t
      ? restSpot(grid, home)
      : home
  const found = route(grid, door, rest)
  if (!found.length)
    return {
      grid,
      rest,
      fallback: true,
      path: [door, { x: door.x, y: rest.y }, rest],
    }
  const last = found[found.length - 1]
  const tail = last.x === rest.x && last.y === rest.y ? [] : [rest]
  return { grid, rest, fallback: false, path: [door, ...found, ...tail] }
}
