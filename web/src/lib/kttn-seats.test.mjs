import assert from "node:assert/strict"
import test from "node:test"

import { seatFrameFor, seatKindFor } from "./kttn-seats.ts"

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

test("폴짝 뛸 때 가구 외곽선과 겹친 고양이 외곽선도 고양이로 든다", async () => {
  const { catOnly } = await import("./kttn-seats.ts")
  const { SEATS } = await import("../kttn/sprite-art/seats.ts")
  const sofa = catOnly(SEATS.sofa.frames.alert, SEATS.sofa.frames.empty)
  assert.equal(sofa[11][15], "k")
  assert.equal(sofa[11][16], "k")
  const sill = catOnly(SEATS.sill.frames.alert, SEATS.sill.frames.empty)
  assert.notEqual(sill[10][11], ".")
  assert.notEqual(sill[10][14], ".")
  // 화면 픽셀과 고양이에서 먼 가구(소파 다리)는 남긴다.
  assert.ok(!sofa.join("").includes("!"))
  assert.equal(sofa[22], ".".repeat(32))
})
