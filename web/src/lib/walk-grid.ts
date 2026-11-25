// 걸을 수 있는 칸 격자와 길 찾기(A*). 칸 하나는 고양이 발밑 한 점이다. 막힌
// 상자(책상, 가구) 안과 걷는 범위 밖은 갈 수 없다. 정해 둔 통로 칸(cheap)은
// 싸게, 꺾는 것은 비싸게 쳐서 길이 통로를 따라 반듯하게 꺾이게 한다. 무엇을
// 막을지는 부르는 쪽(desk-walk.ts)이 정한다.

export type Point = { x: number; y: number }
/** 좌우(l, r)와 위아래(t, b). 막는 상자는 경계를 빼고 안쪽만 막는다. */
export type Box = { l: number; t: number; r: number; b: number }

export type Grid = {
  /** 발밑이 있을 수 있는 범위(경계 포함) */
  bounds: Box
  cell: number
  nx: number
  ny: number
  blocked: Uint8Array
  cheap: Uint8Array
}

const CELL = 2
// 한 칸 걷는 값. 통로 칸은 싸고 나머지 바닥은 비싸다.
const CHEAP_COST = 1
const FLOOR_COST = 3
// 방향을 바꾸는 값. 계단처럼 자주 꺾이지 않게 한다.
const TURN_COST = 8
const DX = [1, -1, 0, 0]
const DY = [0, 0, 1, -1]

export function makeGrid(
  bounds: Box,
  blocks: Box[],
  cheapX: number[] = [],
  cheapY: number[] = [],
  cell = CELL
): Grid {
  const nx = Math.max(1, Math.floor((bounds.r - bounds.l) / cell) + 1)
  const ny = Math.max(1, Math.floor((bounds.b - bounds.t) / cell) + 1)
  const blocked = new Uint8Array(nx * ny)
  const cheap = new Uint8Array(nx * ny)
  for (const box of blocks) {
    const i0 = Math.max(0, Math.floor((box.l - bounds.l) / cell))
    const i1 = Math.min(nx - 1, Math.ceil((box.r - bounds.l) / cell))
    const j0 = Math.max(0, Math.floor((box.t - bounds.t) / cell))
    const j1 = Math.min(ny - 1, Math.ceil((box.b - bounds.t) / cell))
    for (let j = j0; j <= j1; j++) {
      const y = bounds.t + j * cell
      if (y <= box.t || y >= box.b) continue
      for (let i = i0; i <= i1; i++) {
        const x = bounds.l + i * cell
        if (x > box.l && x < box.r) blocked[j * nx + i] = 1
      }
    }
  }
  const near = (v: number, lines: number[]) =>
    lines.some((line) => Math.abs(v - line) < cell)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      if (
        near(bounds.l + i * cell, cheapX) ||
        near(bounds.t + j * cell, cheapY)
      )
        cheap[j * nx + i] = 1
  return { bounds, cell, nx, ny, blocked, cheap }
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi))

/** 점을 상자 안(경계 포함)으로 옮긴다. */
export const clampToBox = (box: Box, p: Point): Point => ({
  x: clamp(p.x, box.l, box.r),
  y: clamp(p.y, box.t, box.b),
})

function cellOf(grid: Grid, p: Point) {
  const { bounds, cell, nx, ny } = grid
  const i = clamp(Math.round((p.x - bounds.l) / cell), 0, nx - 1)
  const j = clamp(Math.round((p.y - bounds.t) / cell), 0, ny - 1)
  return j * nx + i
}

const pointOf = (grid: Grid, c: number): Point => ({
  x: grid.bounds.l + (c % grid.nx) * grid.cell,
  y: grid.bounds.t + Math.floor(c / grid.nx) * grid.cell,
})

const inBounds = (grid: Grid, p: Point) =>
  p.x >= grid.bounds.l - 0.5 &&
  p.x <= grid.bounds.r + 0.5 &&
  p.y >= grid.bounds.t - 0.5 &&
  p.y <= grid.bounds.b + 0.5

/** 발밑이 걸을 수 있는 칸에 있는지(범위 안이고 막힌 칸이 아님) */
export const isFree = (grid: Grid, p: Point) =>
  inBounds(grid, p) && !grid.blocked[cellOf(grid, p)]

/** 가장 가까운 걸을 수 있는 칸(넓이 우선). 모두 막혔으면 -1. */
function nearestFree(grid: Grid, start: number) {
  if (!grid.blocked[start]) return start
  const seen = new Uint8Array(grid.nx * grid.ny)
  const queue = [start]
  seen[start] = 1
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]
    if (!grid.blocked[c]) return c
    const i = c % grid.nx
    const j = Math.floor(c / grid.nx)
    for (let d = 0; d < 4; d++) {
      const ni = i + DX[d]
      const nj = j + DY[d]
      if (ni < 0 || nj < 0 || ni >= grid.nx || nj >= grid.ny) continue
      const n = nj * grid.nx + ni
      if (!seen[n]) {
        seen[n] = 1
        queue.push(n)
      }
    }
  }
  return -1
}

/** 점을 걸을 수 있는 곳으로 묶는다. 범위 밖이나 막힌 칸이면 가장 가까운 칸으로. */
export function settle(grid: Grid, p: Point): Point {
  const inside = clampToBox(grid.bounds, p)
  if (isFree(grid, inside)) return inside
  const c = nearestFree(grid, cellOf(grid, inside))
  return c < 0 ? inside : pointOf(grid, c)
}

// A*에 쓰는 작은 최소 힙(값이 같으면 먼저 넣은 것부터 꺼낼 필요는 없다).
class Heap {
  keys: number[] = []
  items: number[] = []
  get size() {
    return this.items.length
  }
  push(item: number, key: number) {
    const { keys, items } = this
    let k = items.length
    items.push(item)
    keys.push(key)
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (keys[parent] <= key) break
      items[k] = items[parent]
      keys[k] = keys[parent]
      k = parent
    }
    items[k] = item
    keys[k] = key
  }
  pop() {
    const { keys, items } = this
    const top = items[0]
    const lastItem = items.pop() as number
    const lastKey = keys.pop() as number
    const n = items.length
    if (n > 0) {
      let k = 0
      for (;;) {
        let child = 2 * k + 1
        if (child >= n) break
        if (child + 1 < n && keys[child + 1] < keys[child]) child++
        if (keys[child] >= lastKey) break
        items[k] = items[child]
        keys[k] = keys[child]
        k = child
      }
      items[k] = lastItem
      keys[k] = lastKey
    }
    return top
  }
}

/**
 * from에서 to까지 걸을 수 있는 칸만 지나는 길. 꺾이는 점과 마지막 점을
 * 돌려준다(from은 빼고). 막힌 곳에서 나서거나 막힌 곳으로 가면 가장 가까운
 * 걸을 수 있는 칸을 거친다. 길이 없으면 빈 목록이다.
 */
export function route(grid: Grid, from: Point, to: Point): Point[] {
  const { nx, ny } = grid
  const start = nearestFree(grid, cellOf(grid, from))
  const goal = nearestFree(grid, cellOf(grid, to))
  if (start < 0 || goal < 0) return []
  const tail = isFree(grid, to) ? [{ x: to.x, y: to.y }] : []
  if (start === goal) return tail.length ? tail : [pointOf(grid, goal)]
  const states = nx * ny * 4
  const cost = new Float64Array(states).fill(Infinity)
  const from4 = new Int32Array(states).fill(-1)
  const heap = new Heap()
  const gi = goal % nx
  const gj = Math.floor(goal / nx)
  const guess = (c: number) =>
    (Math.abs((c % nx) - gi) + Math.abs(Math.floor(c / nx) - gj)) * CHEAP_COST
  for (let d = 0; d < 4; d++) {
    cost[start * 4 + d] = 0
    heap.push(start * 4 + d, guess(start))
  }
  let found = -1
  while (heap.size) {
    const s = heap.pop()
    const c = s >> 2
    const d = s & 3
    if (c === goal) {
      found = s
      break
    }
    const i = c % nx
    const j = Math.floor(c / nx)
    for (let nd = 0; nd < 4; nd++) {
      const ni = i + DX[nd]
      const nj = j + DY[nd]
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
      const n = nj * nx + ni
      if (grid.blocked[n]) continue
      const step =
        (grid.cheap[n] ? CHEAP_COST : FLOOR_COST) + (nd === d ? 0 : TURN_COST)
      const next = cost[s] + step
      const ns = n * 4 + nd
      if (next >= cost[ns]) continue
      cost[ns] = next
      from4[ns] = s
      heap.push(ns, next + guess(n))
    }
  }
  if (found < 0) return []
  // 거꾸로 따라가며 방향이 바뀌는 칸만 남긴다.
  const cells: number[] = []
  for (let s = found; s >= 0; s = from4[s]) cells.push(s)
  cells.reverse()
  const points: Point[] = []
  for (let k = 1; k < cells.length; k++) {
    const turn = k + 1 < cells.length && (cells[k] & 3) !== (cells[k + 1] & 3)
    if (turn) points.push(pointOf(grid, cells[k] >> 2))
  }
  points.push(pointOf(grid, goal))
  // 마지막 칸과 정확한 목적지가 같으면 하나만 둔다.
  const last = points[points.length - 1]
  if (tail.length && Math.hypot(last.x - to.x, last.y - to.y) < 0.01)
    points.pop()
  return [...points, ...tail]
}
