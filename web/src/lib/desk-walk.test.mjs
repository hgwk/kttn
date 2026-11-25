import assert from "node:assert/strict"
import test from "node:test"

import { officeLayout, seatPoint } from "./desk-layout.ts"
import {
  deskGrid,
  loungeExit,
  standBeside,
  strollPoint,
  walkBounds,
} from "./desk-walk.ts"
import { isFree, route, settle } from "./walk-grid.ts"

// 자유 자리 그림 크기와 발밑(seat-draw의 SEATS와 같은 값)
const SEATS = [
  { w: 24, h: 20, ax: 12, ay: 19 },
  { w: 30, h: 14, ax: 15, ay: 13 },
  { w: 26, h: 22, ax: 13, ay: 21 },
  { w: 32, h: 24, ax: 16, ay: 23 },
  { w: 26, h: 24, ax: 13, ay: 23 },
  { w: 28, h: 20, ax: 14, ay: 19 },
]

/** 자리마다 자유 자리 상자(pattern이 0이면 책상) */
function freeBoxes(layout, count, pattern) {
  return Array.from({ length: count }, (_, index) => {
    const kind = pattern(index)
    if (kind < 0) return null
    const art = SEATS[kind % SEATS.length]
    const at = seatPoint(layout, index)
    return { x: at.x - art.ax, y: at.y - art.ay, w: art.w, h: art.h }
  })
}

const PATTERNS = [
  () => -1,
  (index) => index,
  (index) => (index % 2 ? index : -1),
]

// 길의 모든 점과 선분(0.5px마다)이 걸을 수 있는 칸에 있고 꺾은선이 가로나
// 세로인지 본다. 처음과 끝 1px은 칸에 맞추는 어긋남이라 비스듬해도 된다.
function assertWalkable(grid, from, path, label) {
  assert.ok(path.length > 0, `${label}: 길이 없다`)
  let at = from
  for (const [k, next] of path.entries()) {
    const dx = next.x - at.x
    const dy = next.y - at.y
    const edge = k === 0 || k === path.length - 1
    if (!edge)
      assert.ok(
        Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01,
        `${label}: 비스듬한 선분 ${JSON.stringify(at)}→${JSON.stringify(next)}`
      )
    const steps = Math.ceil(Math.hypot(dx, dy) * 2)
    for (let s = 0; s <= steps; s++) {
      const p = { x: at.x + (dx * s) / steps, y: at.y + (dy * s) / steps }
      assert.ok(isFree(grid, p), `${label}: 막힌 곳 ${JSON.stringify(p)}`)
    }
    at = next
  }
}

test("모든 배치에서 모든 길이 막힌 칸과 방 밖을 지나지 않는다", () => {
  for (let count = 1; count <= 12; count++)
    for (let cols = 1; cols <= 4; cols++)
      for (const [p, pattern] of PATTERNS.entries()) {
        const layout = officeLayout(count, cols)
        const grid = deskGrid(layout, count, freeBoxes(layout, count, pattern))
        const n = Math.min(count, layout.cols * layout.rows)
        for (let index = 0; index < n; index++) {
          const seat = seatPoint(layout, index)
          const label = `${count}마리 ${cols}열 무늬${p} 자리${index}`
          assert.ok(isFree(grid, seat), `${label}: 자리가 막혔다`)
          const goals = [
            layout.door,
            strollPoint(layout, index),
            loungeExit(layout, index),
            standBeside(layout, (index + 1) % n),
            standBeside(layout, n - 1 - index),
          ]
          for (const goal of goals) {
            assertWalkable(grid, seat, route(grid, seat, goal), `${label} 가는 길`)
            assertWalkable(grid, goal, route(grid, goal, seat), `${label} 오는 길`)
          }
        }
      }
})

test("방 밖이나 막힌 곳에 있으면 가장 가까운 걸을 수 있는 칸으로 묶는다", () => {
  const layout = officeLayout(3, 3)
  const grid = deskGrid(layout, 3)
  const bounds = walkBounds(layout)
  for (const p of [
    { x: -40, y: 300 },
    { x: layout.w + 50, y: 10 },
    { x: 60, y: 60 },
  ]) {
    const q = settle(grid, p)
    assert.ok(isFree(grid, q), JSON.stringify(q))
    assert.ok(q.x >= bounds.l && q.x <= bounds.r)
    assert.ok(q.y >= bounds.t && q.y <= bounds.b)
  }
})

test("길은 통로를 따라 몇 번만 꺾인다", () => {
  const layout = officeLayout(8, 4)
  const grid = deskGrid(layout, 8)
  const path = route(grid, seatPoint(layout, 7), layout.door)
  assert.ok(path.length <= 7, JSON.stringify(path))
})

test("큰 배치에서도 길 하나를 찾는 데 오래 걸리지 않는다", () => {
  const layout = officeLayout(12, 1)
  const grid = deskGrid(layout, 12)
  const started = performance.now()
  for (let k = 0; k < 12; k++)
    route(grid, seatPoint(layout, 11 - k), layout.door)
  assert.ok(performance.now() - started < 600)
})
