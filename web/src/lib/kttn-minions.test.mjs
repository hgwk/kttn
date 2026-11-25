import assert from "node:assert/strict"
import test from "node:test"

import { shownMinions } from "./kttn-minions.ts"

const m = (id, waiting) => (waiting ? { id, waiting: true } : { id })
const ids = (list) => list.map((minion) => minion.id)

test("draws the first four kittens in place when none hidden is waiting", () => {
  const list = [m("a"), m("b", true), m("c"), m("d"), m("e"), m("f")]
  assert.deepEqual(ids(shownMinions(list)), ["a", "b", "c", "d"])
})

test("brings a hidden waiting kitten into view without moving the others", () => {
  const list = [m("a"), m("b"), m("c"), m("d"), m("e"), m("f", true)]
  // 기다리지 않는 마지막 자리(d)에 f가 서고, a·b·c는 그 자리 그대로다.
  assert.deepEqual(ids(shownMinions(list)), ["a", "b", "c", "f"])
})

test("keeps visible waiting kittens and fills from the back", () => {
  const list = [m("a"), m("b"), m("c", true), m("d", true), m("e", true), m("f", true), m("g", true)]
  // c·d는 이미 보이고 기다린다. 숨은 e·f가 b·a 자리를 차례로 채우고, g는 자리가 없다.
  assert.deepEqual(ids(shownMinions(list)), ["f", "e", "c", "d"])
})

test("draws fewer than four as they are", () => {
  assert.deepEqual(ids(shownMinions([m("a", true), m("b")])), ["a", "b"])
  assert.deepEqual(shownMinions([]), [])
})
