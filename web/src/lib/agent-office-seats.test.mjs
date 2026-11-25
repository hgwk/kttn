import assert from "node:assert/strict"
import test from "node:test"

import { seatFrameFor, seatKindFor } from "./agent-office-seats.ts"

const NAMES = ["cushion", "tabletBelly", "beanBag", "sofa", "sill", "kotatsu"]

test("같은 key는 늘 같은 자리, 그림이 없으면 책상", () => {
  assert.equal(seatKindFor("a:1", NAMES), seatKindFor("a:1", NAMES))
  assert.equal(seatKindFor("a:1", []), null)
})

test("고양이 절반쯤은 책상, 나머지는 자유 자리를 고루 쓴다", () => {
  const seen = new Map()
  for (let i = 0; i < 2000; i++) {
    const kind = seatKindFor(`session-${i}`, NAMES) ?? "desk"
    seen.set(kind, (seen.get(kind) ?? 0) + 1)
  }
  assert.ok(seen.get("desk") > 850 && seen.get("desk") < 1150)
  for (const name of NAMES) assert.ok(seen.get(name) > 100, name)
})

test("자세에 맞춰 칸을 고른다", () => {
  assert.equal(seatFrameFor("alert", "needs_you", 0), "alert")
  assert.equal(seatFrameFor("sleep", "sleeping", 0), "rest")
  assert.equal(seatFrameFor("sit", "done", 0), "rest")
  assert.notEqual(seatFrameFor("type", "editing", 0), seatFrameFor("type", "editing", 220))
  assert.equal(seatFrameFor("sit", "thinking", 0), "idle")
  assert.equal(seatFrameFor("dizzy", "working", 0), "idle")
})
