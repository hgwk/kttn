import assert from "node:assert/strict"
import test from "node:test"

import { seasonAt } from "./agent-office-season.ts"

// 이 컴퓨터 시각(지역 시간)으로 만든다.
const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min)

test("12월에만 겨울이다", () => {
  assert.equal(seasonAt(at(2026, 11, 30, 23, 59)).december, false)
  assert.equal(seasonAt(at(2026, 12, 1, 0, 0)).december, true)
  assert.equal(seasonAt(at(2026, 12, 31, 23, 59)).december, true)
  assert.equal(seasonAt(at(2027, 1, 1, 0, 0)).december, false)
})

test("새벽은 0시부터 5시 전까지다", () => {
  assert.equal(seasonAt(at(2026, 11, 25, 23, 59)).dawn, false)
  assert.equal(seasonAt(at(2026, 11, 25, 0, 0)).dawn, true)
  assert.equal(seasonAt(at(2026, 11, 25, 4, 59)).dawn, true)
  assert.equal(seasonAt(at(2026, 11, 25, 5, 0)).dawn, false)
})

test("주소 값으로 켜고 끄며, 모르는 값은 무시한다", () => {
  const nov = at(2026, 11, 25, 12, 0)
  const dec = at(2026, 12, 25, 3, 0)
  assert.deepEqual(seasonAt(nov, "?season=december&dawn=1"), {
    december: true,
    dawn: true,
  })
  assert.deepEqual(seasonAt(dec, "?season=none&dawn=0"), {
    december: false,
    dawn: false,
  })
  assert.deepEqual(seasonAt(nov, "?season=summer&dawn=yes"), {
    december: false,
    dawn: false,
  })
})
