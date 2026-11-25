import assert from "node:assert/strict"
import test from "node:test"

import { LOUNGE_HALF, loungeRoute } from "./lounge-route.ts"
import { isFree } from "./walk-grid.ts"

// 휴게 공간(화면 px, 확대 전). 제자리 발밑이 (0, 0)이 되게 옮겨 둔 상자들이다.
const box = (l, t, w, h) => ({ l, t, r: l + w, b: t + h })

// 길의 모든 점과 선분(1px마다)이 걸을 수 있는 칸에 있는지.
function assertWalkable(grid, path, label, props = []) {
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]
    const b = path[k]
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)))
    for (let s = 0; s <= steps; s++) {
      const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps }
      assert.ok(isFree(grid, p), `${label}: 막힌 곳 ${JSON.stringify(p)}`)
      // 격자와 따로, 소품 상자 원본에 몸(반폭 16)이 걸치지 않는지도 본다.
      for (const o of props)
        assert.ok(
          !(p.x > o.l - LOUNGE_HALF && p.x < o.r + LOUNGE_HALF && p.y > o.t && p.y < o.b),
          `${label}: 소품 ${JSON.stringify(o)}에 걸침 ${JSON.stringify(p)}`
        )
    }
  }
}

// 바닥 줄에 소품이 늘어선 휴게 공간. 찾아가는 소품은 넘기지 않는다(화면 쪽과 같다).
function lounge(targetIndex) {
  const row = [box(-140, -40, 40, 40), box(-92, -24, 24, 24), box(8, -30, 30, 30), box(46, -60, 40, 60), box(120, -20, 36, 20)]
  const wall = box(-100, -140, 220, 16)
  const props = [wall, ...row.filter((_, index) => index !== targetIndex)]
  return { room: box(-200, -160, 420, 200), props, door: { x: -40, y: -180 } }
}

test("소품 여러 개 사이에서 길의 모든 점과 선분이 막힌 칸을 지나지 않는다", () => {
  for (let target = 0; target < 5; target++) {
    const { room, props, door } = lounge(target)
    for (const home of [{ x: 0, y: 0 }, { x: -120, y: -10 }, { x: 140, y: -40 }]) {
      const { grid, path, rest, fallback } = loungeRoute(room, props, door, home)
      const label = `소품${target} ${JSON.stringify(home)}`
      assert.equal(fallback, false, label)
      assert.deepEqual(path[0], door)
      assert.deepEqual(path[path.length - 1], rest)
      assert.ok(isFree(grid, rest), `${label}: 설 자리가 막혔다`)
      assertWalkable(grid, path, label, props)
    }
  }
})

test("찾아가는 소품은 막지 않아 그 위(자는 자리)에도 그대로 선다", () => {
  // 침대(가운데 0, 0) 위에서 잔다. 침대는 넘기지 않으므로 제자리 그대로다.
  const { room, props, door } = lounge(2)
  const { rest, path } = loungeRoute(room, props, door, { x: 23, y: -15 })
  assert.deepEqual(rest, { x: 23, y: -15 })
  assert.deepEqual(path.at(-1), { x: 23, y: -15 })
})

test("제자리가 방 벽에 걸치면 방 안으로, 이웃 소품에 겹치면 옆 빈 칸으로 비킨다", () => {
  const room = box(0, -100, 300, 100)
  // 왼쪽 벽에 붙은 피아노 앞: 원래 제자리(x 4)는 몸 반폭(16)만큼 벽 밖이다.
  const wall = loungeRoute(room, [], { x: 150, y: -110 }, { x: 4, y: 0 })
  assert.ok(wall.rest.x >= room.l + LOUNGE_HALF, JSON.stringify(wall.rest))
  // 이웃 소품(오른쪽 끝이 x 0)과 몸이 겹치는 제자리는 같은 높이에서 옆으로 비킨다.
  const near = loungeRoute(room, [box(-30, -24, 30, 24)].map((b) => ({ ...b, l: b.l + 100, r: b.r + 100 })), { x: 150, y: -110 }, { x: 108, y: 0 })
  assert.equal(near.rest.y, 0)
  assert.ok(near.rest.x >= 100 + LOUNGE_HALF, JSON.stringify(near.rest))
  assert.ok(isFree(near.grid, near.rest))
})

test("길이 없으면(문이 소품에 둘러싸임) 예전처럼 세로로 내려온 뒤 가로로 간다", () => {
  const room = box(-100, -100, 200, 100)
  const door = { x: 0, y: -110 }
  // 문 아래를 휴게 공간 폭 전체로 막는다.
  const props = [box(-120, -80, 240, 20)]
  const { path, fallback, rest } = loungeRoute(room, props, door, { x: 0, y: 0 })
  assert.equal(fallback, true)
  assert.deepEqual(path, [door, { x: door.x, y: rest.y }, rest])
})
