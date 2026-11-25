import assert from "node:assert/strict"
import test from "node:test"

import { paperFacts } from "./kttn-paper.ts"

const now = Date.parse("2026-11-25T05:00:00Z")
const today = new Date(now).toLocaleDateString("sv")

test("오늘 집계가 있으면 가장 바쁜 고양이와 실패 수를 낸다", () => {
  const facts = paperFacts({
    today,
    now,
    cats: [
      { key: "a", name: "A", lastSeen: new Date(now).toISOString(), day: { date: today, tools: 40, failures: 2 } },
      { key: "b", name: "B", lastSeen: new Date(now).toISOString(), day: { date: today, tools: 90, failures: 1 } },
      { key: "c", name: "C", lastSeen: "2026-01-01T00:00:00Z", day: { date: "2026-01-01", tools: 999, failures: 9 } },
    ],
    sleepers: [],
  })
  assert.equal(facts.busiest?.key, "b")
  assert.equal(facts.failures, 3)
  assert.equal(facts.cats, 2)
})

test("집계가 없으면 그 기사는 빠지고, 가장 오래 조는 고양이를 고른다", () => {
  const facts = paperFacts({
    today,
    now,
    cats: [{ key: "a", name: "A", lastSeen: new Date(now).toISOString() }],
    sleepers: [
      { key: "x", name: "X", since: new Date(now - 60_000).toISOString() },
      { key: "y", name: "Y", since: new Date(now - 3_600_000).toISOString() },
      { key: "z", name: "Z", since: "bad" },
    ],
  })
  assert.equal(facts.busiest, undefined)
  assert.equal(facts.failures, undefined)
  assert.equal(facts.dozer?.key, "y")
})
