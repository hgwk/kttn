import assert from "node:assert/strict"
import test from "node:test"

import { titlesFor } from "./agent-office-titles.ts"

const now = Date.parse("2026-11-25T03:00:00Z")

test("도구 수 칭호는 가장 높은 것 하나만 단다", () => {
  assert.deepEqual(titlesFor({ tools: 99 }, now), [])
  assert.deepEqual(titlesFor({ tools: 100 }, now), ["worker"])
  assert.deepEqual(titlesFor({ tools: 500 }, now), ["veteran"])
  assert.deepEqual(titlesFor({ tools: 1000 }, now), ["legend"])
})

test("올빼미와 고참은 도구 수 칭호와 함께 단다", () => {
  const old = new Date(now - 8 * 86_400_000).toISOString()
  assert.deepEqual(
    titlesFor({ tools: 600, firstSeen: old, nightOwl: true }, now),
    ["veteran", "nightOwl", "oldHand"]
  )
  const recent = new Date(now - 86_400_000).toISOString()
  assert.deepEqual(titlesFor({ tools: 0, firstSeen: recent }, now), [])
  assert.deepEqual(titlesFor({ tools: 0, firstSeen: "bad" }, now), [])
})
