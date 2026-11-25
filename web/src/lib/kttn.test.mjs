import assert from "node:assert/strict"
import test from "node:test"

import {
  SLEEP_AFTER_MS,
  byUrgency,
  catNames,
  compactFolderTree,
  levelFor,
  levelUpKeys,
  areaName,
  peerTag,
  shortFolder,
  nestAreas,
  kttnCounts,
  stateDuration,
  toSessionAgents,
} from "./kttn.ts"

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

test("maps relay rows to screen agents with Korean state names", () => {
  const [agent] = toSessionAgents({ agents: [row()] }, now)
  assert.equal(agent.state, "editing")
  assert.equal(agent.stateLabel, "고치는 중")
  assert.equal(agent.sessionShort, "abcd")
  assert.equal(agent.minions.length, 1)
})

test("silent sessions fall asleep, but waiting and ended ones do not", () => {
  const old = new Date(now - SLEEP_AFTER_MS - 1000).toISOString()
  const [sleepy, waiting, gone] = toSessionAgents(
    {
      agents: [
        row({ updated_at: old }),
        row({ key: "b", session: "b", state: "needs_you", updated_at: old }),
        row({ key: "c", session: "c", state: "ended", updated_at: old }),
      ],
    },
    now
  )
  assert.equal(sleepy.state, "sleeping")
  assert.equal(sleepy.detail, "")
  assert.equal(waiting.state, "needs_you")
  assert.equal(gone.state, "ended")
  assert.deepEqual(gone.minions, [])
})

test("drops malformed rows and payloads instead of guessing", () => {
  assert.deepEqual(toSessionAgents(null, now), [])
  assert.deepEqual(toSessionAgents({ agents: "nope" }, now), [])
  const agents = toSessionAgents(
    {
      agents: [
        row({ state: "dancing" }),
        row({ key: "" }),
        row({ session: 5 }),
        "junk",
        row({ key: "ok", minions: [null, { id: "x", label: 9 }] }),
      ],
    },
    now
  )
  assert.equal(agents.length, 1)
  assert.deepEqual(agents[0].minions, [{ id: "x", label: "" }])
})

test("marks only the sub-agent the server says is waiting on a person", () => {
  const [agent] = toSessionAgents(
    {
      agents: [
        row({
          key: "w",
          minions: [
            { id: "a", label: "Explore", waiting: true },
            { id: "b", label: "Plan" },
            { id: "c", label: "Test", waiting: "yes" },
          ],
        }),
      ],
    },
    now
  )
  assert.deepEqual(agent.minions, [
    { id: "a", label: "Explore", waiting: true },
    { id: "b", label: "Plan" },
    { id: "c", label: "Test" },
  ])
})

function agentsOf(rows) {
  return toSessionAgents({ agents: rows }, now)
}

test("lists waiting sessions first and ended ones last", () => {
  const agents = agentsOf([
    row({ key: "a", session: "a", state: "ended" }),
    row({ key: "b", session: "b", state: "done" }),
    row({
      key: "c",
      session: "c",
      state: "needs_you",
      status_since: "2026-11-19T08:58:00Z",
    }),
    row({
      key: "d",
      session: "d",
      state: "needs_you",
      status_since: "2026-11-19T08:50:00Z",
    }),
    row({ key: "e", session: "e", state: "running" }),
  ])
  assert.deepEqual(
    byUrgency(agents).map((agent) => agent.key),
    ["d", "c", "e", "b", "a"]
  )
  assert.deepEqual(
    agents.map((agent) => agent.key),
    ["a", "b", "c", "d", "e"]
  )
})

test("counts sessions by what they need from the user", () => {
  const old = new Date(now - SLEEP_AFTER_MS - 1000).toISOString()
  assert.deepEqual(
    kttnCounts(
      agentsOf([
        row({ key: "a", session: "a", state: "needs_you" }),
        row({ key: "b", session: "b", state: "thinking" }),
        row({ key: "c", session: "c", state: "idle" }),
        row({ key: "d", session: "d", updated_at: old }),
        row({ key: "e", session: "e", state: "ended" }),
      ])
    ),
    { needsYou: 1, busy: 1, waiting: 1, resting: 1, ended: 1 }
  )
  assert.deepEqual(kttnCounts([]), {
    needsYou: 0,
    busy: 0,
    waiting: 0,
    resting: 0,
    ended: 0,
  })
})

test("says how long a state has lasted, and nothing for bad times", () => {
  assert.equal(stateDuration("2026-11-19T08:59:30Z", now), "방금부터")
  assert.equal(stateDuration("2026-11-19T08:57:00Z", now), "3분째")
  assert.equal(stateDuration("2026-11-19T06:00:00Z", now), "3시간째")
  assert.equal(stateDuration("", now), "")
  assert.equal(stateDuration("2026-11-19T09:05:00Z", now), "")
})

test("folds empty single-child folders into one line but keeps the root", () => {
  const [agent] = agentsOf([row()])
  const leaf = {
    name: "console",
    path: "ledger/apps/console",
    agents: [agent],
    children: [],
  }
  const tree = {
    name: "myrepo",
    path: "",
    agents: [],
    children: [
      {
        name: "ledger",
        path: "ledger",
        agents: [],
        children: [
          { name: "apps", path: "ledger/apps", agents: [], children: [leaf] },
        ],
      },
    ],
  }
  const compact = compactFolderTree(tree)
  assert.equal(compact.name, "myrepo")
  assert.equal(compact.children.length, 1)
  assert.equal(compact.children[0].name, "ledger/apps/console")
  assert.equal(compact.children[0].path, "ledger/apps/console")
  assert.equal(compact.children[0].agents.length, 1)
  assert.equal(tree.children[0].name, "ledger")
})
