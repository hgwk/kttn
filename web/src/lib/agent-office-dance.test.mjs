import assert from "node:assert/strict"
import test from "node:test"

import { SECRET, danceStep, pressSecret } from "./agent-office-dance.ts"

const run = (keys) => {
  let matched = 0
  let done = false
  for (const key of keys) ({ matched, done } = pressSecret(matched, key))
  return { matched, done }
}

test("비밀 키를 차례로 누르면 춤춘다", () => {
  assert.equal(run(SECRET).done, true)
  assert.equal(run(SECRET.map((k) => k.toUpperCase?.() ?? k)).done, false)
  assert.equal(run([...SECRET.slice(0, 8), "B", "A"]).done, true)
})

test("중간에 틀리면 처음부터, 위를 한 번 더 눌러도 이어진다", () => {
  assert.equal(run(["ArrowUp", "x", ...SECRET.slice(1)]).done, false)
  assert.equal(run(["ArrowUp", ...SECRET]).done, true)
})

test("춤 동작은 250ms마다 바뀐다", () => {
  assert.notDeepEqual(danceStep(0), danceStep(250))
  assert.deepEqual(danceStep(0), danceStep(1000))
})
