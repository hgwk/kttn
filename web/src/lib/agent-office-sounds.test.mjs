import assert from "node:assert/strict"
import test from "node:test"

import { soundCues } from "./agent-office-sounds.ts"

test("상태가 바뀐 세션만 소리를 낸다", () => {
  const prev = new Map([
    ["a", "editing"],
    ["b", "thinking"],
    ["c", "done"],
  ])
  const next = [
    { key: "a", state: "done" },
    { key: "b", state: "needs_you" },
    { key: "c", state: "done" },
    { key: "d", state: "needs_you" },
  ]
  assert.deepEqual(soundCues(prev, next), ["needsYou", "done"])
  assert.deepEqual(soundCues(prev, next, ["a"]), [
    "needsYou",
    "levelUp",
    "done",
  ])
})

test("화면을 연 첫 현황에서는 소리를 내지 않는다", () => {
  const next = [{ key: "a", state: "needs_you" }]
  assert.deepEqual(soundCues(null, next, ["a"]), [])
})
