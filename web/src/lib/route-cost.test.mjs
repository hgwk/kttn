import assert from "node:assert/strict"
import test from "node:test"

import { deskLayout, seatPoint } from "./desk-layout.ts"
import { deskGrid, loungeExit, standBeside, strollPoint } from "./desk-walk.ts"
import { loungeGrid } from "./lounge-route.ts"
import { isFree, route, routeStats } from "./walk-grid.ts"

// A*가 찾은 길의 값이 가장 싼 길(따로 짠 Dijkstra)과 같은지 본다. 어림값이 넘쳐
// 길이 길어지는 회귀를 잡는다. 값은 walk-grid.ts와 같다(통로 1, 바닥 3, 꺾기 8).
const DX = [1, -1, 0, 0]
const DY = [0, 0, 1, -1]
function cheapest(grid, from, to) {
  const cellOf = (p) =>
    Math.round((p.y - grid.bounds.t) / grid.cell) * grid.nx +
    Math.round((p.x - grid.bounds.l) / grid.cell)
  const goal = cellOf(to)
  const best = new Float64Array(grid.nx * grid.ny * 4).fill(Infinity)
  // 값이 가장 작은 것부터 꺼내는 이진 힙([값, 상태] 쌍)
  const heap = []
  const push = (item) => {
    heap.push(item)
    for (let k = heap.length - 1; k > 0; ) {
      const up = (k - 1) >> 1
      if (heap[up][0] <= heap[k][0]) break
      ;[heap[up], heap[k]] = [heap[k], heap[up]]
      k = up
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      for (let k = 0; ; ) {
        let c = 2 * k + 1
        if (c >= heap.length) break
        if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++
        if (heap[k][0] <= heap[c][0]) break
        ;[heap[k], heap[c]] = [heap[c], heap[k]]
        k = c
      }
    }
    return top
  }
  for (let d = 0; d < 4; d++) {
    best[cellOf(from) * 4 + d] = 0
    push([0, cellOf(from) * 4 + d])
  }
  while (heap.length) {
    const [value, s] = pop()
    if (value > best[s]) continue
    const c = s >> 2
    if (c === goal) return value
    const i = c % grid.nx
    const j = Math.floor(c / grid.nx)
    for (let d = 0; d < 4; d++) {
      const ni = i + DX[d]
      const nj = j + DY[d]
      if (ni < 0 || nj < 0 || ni >= grid.nx || nj >= grid.ny) continue
      const n = nj * grid.nx + ni
      if (grid.blocked[n]) continue
      const next = value + (grid.cheap[n] ? 1 : 3) + (d === (s & 3) ? 0 : 8)
      if (next < best[n * 4 + d]) {
        best[n * 4 + d] = next
        push([next, n * 4 + d])
      }
    }
  }
  return Infinity
}

// 칸 위의 점(칸에 맞춘 출발점과 도착점)끼리만 견준다.
const onCell = (grid, p) => ({
  x: grid.bounds.l + Math.round((p.x - grid.bounds.l) / grid.cell) * grid.cell,
  y: grid.bounds.t + Math.round((p.y - grid.bounds.t) / grid.cell) * grid.cell,
})

function assertCheapest(grid, a, b, label) {
  const from = onCell(grid, a)
  const to = onCell(grid, b)
  if (!isFree(grid, from) || !isFree(grid, to)) return 0
  assert.ok(route(grid, from, to).length, `${label}: 길이 없다`)
  assert.equal(routeStats.cost, cheapest(grid, from, to), label)
  return 1
}

test("책상 구역의 길은 가장 싼 길이다", () => {
  let checked = 0
  for (const [count, cols] of [[3, 3], [5, 2], [8, 4], [7, 1]]) {
    const layout = deskLayout(count, cols)
    const grid = deskGrid(layout, count)
    for (let index = 0; index < count; index++) {
      const seat = seatPoint(layout, index)
      for (const goal of [layout.door, strollPoint(layout, index), loungeExit(layout, index), standBeside(layout, count - 1 - index)])
        checked += assertCheapest(grid, seat, goal, `${count}마리 ${cols}열 자리${index}`)
    }
  }
  assert.ok(checked > 60, `견준 길 ${checked}개`)
})

test("휴게 공간의 길은 가장 싼 길이다", () => {
  const box = (l, t, w, h) => ({ l, t, r: l + w, b: t + h })
  const room = box(0, 0, 600, 300)
  // 문 바로 아래를 넓게 막아 돌아가야 하는 배치(어림값이 넘치면 엉뚱한 쪽으로 돈다)
  const props = [
    box(60, 200, 40, 40),
    box(180, 120, 60, 60),
    box(320, 220, 30, 30),
    box(420, 60, 80, 24),
    box(200, 20, 240, 30),
    box(100, 260, 300, 16),
  ]
  const door = { x: 300, y: -12 }
  const grid = loungeGrid(room, props, door)
  let checked = 0
  for (const home of [
    { x: 40, y: 290 },
    { x: 260, y: 290 },
    { x: 560, y: 100 },
    { x: 150, y: 60 },
    { x: 300, y: 240 },
    { x: 280, y: 100 },
  ])
    checked += assertCheapest(grid, door, home, JSON.stringify(home))
  assert.ok(checked >= 5, `견준 길 ${checked}개`)
})
