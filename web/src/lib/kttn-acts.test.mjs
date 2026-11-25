import assert from "node:assert/strict"
import test from "node:test"

import { toSessionAgents } from "./kttn.ts"
import {
  IDLE_SLOT_MS,
  MINGLE_MS,
  MOMENT_MS,
  STROLL_MS,
  VISIT_MS,
  modelLabel,
  idleActivity,
  mingle,
  propPick,
  recentMoment,
  troubleText,
  visitingName,
} from "./kttn-acts.ts"

const now = Date.parse("2026-11-19T09:00:00Z")

function row(overrides = {}) {
  return {
    key: "claude|abcd-1234",
    source: "claude",
    session: "abcd-1234",
    project: "myrepo",
    state: "editing",
    detail: "page.tsx",
    minions: [{ id: "t1", label: "Explore" }],
    tool_count: 3,
    status_since: "2026-11-19T08:59:00Z",
    updated_at: "2026-11-19T08:59:30Z",
    ...overrides,
  }
}


test("메시지를 보낸 뒤 10초 동안만 그 세션에게 얘기하는 중이다", () => {
  const at = "2026-11-23T05:00:00.000Z"
  const base = Date.parse(at)
  const agent = { visitTo: "myrepo-21", visitAt: at, state: "working" }
  assert.equal(visitingName(agent, base + 1_000), "myrepo-21")
  assert.equal(visitingName(agent, base + VISIT_MS), "")
  assert.equal(visitingName(agent, base - 1), "")
  assert.equal(visitingName({ ...agent, state: "ended" }, base + 1_000), "")
  assert.equal(visitingName({ ...agent, visitTo: "" }, base + 1_000), "")
})

test("도구 실패 같은 순간은 그 종류일 때 잠깐만 보인다", () => {
  const at = "2026-11-23T05:00:00.000Z"
  const base = Date.parse(at)
  const agent = { moment: { kind: "PostToolUseFailure", detail: "Bash", at } }
  assert.equal(
    recentMoment(agent, "PostToolUseFailure", base + 1)?.detail,
    "Bash"
  )
  assert.equal(
    recentMoment(agent, "PostToolUseFailure", base + MOMENT_MS),
    null
  )
  assert.equal(recentMoment(agent, "PreCompact", base + 1), null)
  assert.equal(recentMoment({ moment: null }, "PostToolUseFailure", base), null)
})

test("멈춘 까닭은 쉬운 말로 보인다", () => {
  assert.equal(troubleText(""), "")
  assert.equal(troubleText("rate_limit"), "사용 한도에 걸려 멈췄다냥.")
  assert.equal(troubleText("weird_error"), "오류로 멈췄다냥. (weird_error)")
})

test("오래 쉬는 고양이는 1분마다 여러 가지 일을 하고, 캣타워는 있을 때만 간다", () => {
  const agent = { key: "claude|abc", state: "sleeping" }
  const seen = new Set()
  const towerSeen = new Set()
  for (let slot = 0; slot < 200; slot++) {
    const now = slot * IDLE_SLOT_MS + 1
    seen.add(idleActivity(agent, now))
    towerSeen.add(idleActivity(agent, now, true))
    // 같은 1분 안에서는 바뀌지 않는다. 산책만 처음 STROLL_MS 뒤로는 존다.
    const first = idleActivity(agent, now)
    const late = idleActivity(agent, now + IDLE_SLOT_MS - 2)
    assert.equal(late, first === "stroll" ? "doze" : first)
    assert.equal(idleActivity(agent, now + STROLL_MS - 2), first)
  }
  assert.deepEqual([...seen].sort(), ["doze", "groom", "stroll", "window"])
  assert.ok(towerSeen.has("tower"))
  assert.equal(idleActivity({ ...agent, state: "working" }, 1), "")
})

test("같은 책상 구역의 쉬는 고양이들은 1분마다 서로 다른 일을 나눠 가진다", () => {
  const mates = [
    { key: "claude|a", state: "sleeping" },
    { key: "claude|b", state: "sleeping" },
    { key: "claude|c", state: "working" },
    { key: "claude|d", state: "sleeping" },
    { key: "claude|e", state: "sleeping" },
  ]
  for (let slot = 0; slot < 50; slot++) {
    // 산책이 졸기로 바뀌지 않는 1분의 처음
    const now = slot * IDLE_SLOT_MS + 1
    const picks = mates
      .filter((mate) => mate.state === "sleeping")
      .map((mate) => idleActivity(mate, now, false, mates))
    assert.equal(new Set(picks).size, 4)
  }
  assert.equal(idleActivity(mates[2], 1, false, mates), "")
})

test("쉬는 고양이가 많은 구역에서도 산책 뒤에 졸기가 몰리지 않는다", () => {
  const crowd = ["a", "b", "c", "d", "e", "f"].map((key) => ({
    key: `claude|${key}`,
    state: "sleeping",
  }))
  for (let slot = 0; slot < 100; slot++) {
    const late = slot * IDLE_SLOT_MS + STROLL_MS + 1
    const dozing = crowd.filter(
      (mate) => idleActivity(mate, late, false, crowd) === "doze"
    )
    assert.ok(dozing.length <= 2)
    // 늦게 열려 산책을 나서지 못한 화면에서도 1분의 처음부터 똑같다.
    const early = slot * IDLE_SLOT_MS + 5_000
    const missed = crowd.map((mate) =>
      idleActivity(mate, early, false, crowd, true)
    )
    assert.ok(!missed.includes("stroll"))
    assert.ok(missed.filter((act) => act === "doze").length <= 2)
  }
})

test("산책을 다녀온 고양이는 옆 고양이가 안 하는 일을 해, 둘뿐인 구역에서 함께 졸지 않는다", () => {
  const pair = [
    { key: "claude|eb", state: "sleeping" },
    { key: "claude|e3", state: "sleeping" },
  ]
  for (let slot = 0; slot < 200; slot++) {
    const late = slot * IDLE_SLOT_MS + STROLL_MS + 1
    const [one, two] = pair.map((mate) => idleActivity(mate, late, false, pair))
    assert.notEqual(one, two)
    assert.ok(one !== "stroll" && two !== "stroll")
  }
})

test("모델 이름은 짧게 보인다", () => {
  assert.equal(modelLabel("claude-opus-5-5"), "opus 5.5")
  assert.equal(modelLabel("claude-haiku-5"), "haiku 5")
  assert.equal(modelLabel("gpt-6-luna"), "gpt 6 luna")
  assert.equal(modelLabel(""), "")
})

test("쉬는 고양이는 찾아갈 소품이 있으면 졸 차례에 가끔 소품에 간다", () => {
  const agent = { key: "claude|visit", state: "sleeping" }
  const seen = new Set()
  for (let slot = 0; slot < 200; slot++) {
    const now = slot * IDLE_SLOT_MS + STROLL_MS + 1
    const none = idleActivity(agent, now, { tower: false, props: 0 })
    const some = idleActivity(agent, now, { tower: false, props: 3 })
    assert.notEqual(none, "prop")
    // 소품이 있어도 졸 차례가 아닌 일은 그대로다.
    if (none !== "doze") assert.equal(some, none)
    seen.add(some)
  }
  assert.ok(seen.has("prop") && seen.has("doze"))
  for (let i = 0; i < 50; i++) {
    const pick = propPick(`claude|${i}`, i * IDLE_SLOT_MS, 4)
    assert.ok(pick >= 0 && pick < 4)
  }
  assert.equal(propPick("claude|x", 0, 0), 0)
})

test("쉬는 고양이끼리는 가끔 한 쌍이 만나고, 둘이 서로를 상대로 안다", () => {
  const cats = ["a", "b", "c", "d"].map((key) => ({ key, state: "sleeping" }))
  let met = 0
  for (let slot = 0; slot < 60; slot++) {
    const at = slot * IDLE_SLOT_MS + 1_000
    const meets = cats.map((cat) => mingle(cat, at, cats))
    const visitors = meets.filter((m) => m?.role === "visitor")
    const hosts = meets.filter((m) => m?.role === "host")
    assert.equal(visitors.length, hosts.length)
    assert.ok(visitors.length <= 1)
    if (!visitors.length) continue
    met++
    const v = cats[meets.findIndex((m) => m?.role === "visitor")]
    const h = cats[meets.findIndex((m) => m?.role === "host")]
    assert.notEqual(v.key, h.key)
    assert.equal(meets[cats.indexOf(v)].other, h.key)
    assert.equal(meets[cats.indexOf(h)].other, v.key)
    // 만남 시간이 지나면 끝난다.
    assert.equal(mingle(v, slot * IDLE_SLOT_MS + MINGLE_MS, cats), null)
  }
  // 세 번에 한 번쯤(60칸에 0이나 60은 아니다)
  assert.ok(met > 5 && met < 40, `met ${met}`)
})

test("쉬는 고양이가 하나뿐이거나 쉬는 중이 아니면 만나지 않는다", () => {
  const one = [
    { key: "a", state: "sleeping" },
    { key: "b", state: "editing" },
  ]
  for (let slot = 0; slot < 30; slot++) {
    const at = slot * IDLE_SLOT_MS
    assert.equal(mingle(one[0], at, one), null)
    assert.equal(mingle(one[1], at, one), null)
  }
})
