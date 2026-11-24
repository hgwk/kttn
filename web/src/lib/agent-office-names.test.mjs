import assert from "node:assert/strict"
import test from "node:test"

import {
  catNames,
  levelFor,
  levelUpKeys,
  nestOffices,
  officeName,
  peerTag,
  shortFolder,
  toSessionAgents,
} from "./agent-office.ts"

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

function agentsOf(rows) {
  return toSessionAgents({ agents: rows }, now)
}


test("levels up after 5, 15, 30 tool uses and reports progress to the next level", () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, need: 5 })
  assert.deepEqual(levelFor(4), { level: 1, into: 4, need: 5 })
  assert.deepEqual(levelFor(5), { level: 2, into: 0, need: 10 })
  assert.deepEqual(levelFor(16), { level: 3, into: 1, need: 15 })
  assert.deepEqual(levelFor(30), { level: 4, into: 0, need: 20 })
  assert.deepEqual(levelFor(-3), { level: 1, into: 0, need: 5 })
})

test("reports only sessions whose level rose since the last screen", () => {
  const a = (key, toolCount) => ({ key, toolCount })
  const prev = [a("k1", 4), a("k2", 5), a("k3", 14)]
  const next = [a("k1", 5), a("k2", 9), a("k3", 15), a("k4", 40)]
  assert.deepEqual(levelUpKeys(prev, next), ["k1", "k3"])
  assert.deepEqual(levelUpKeys(next, next), [])
})

test("gives each session a stable Korean cat name without repeats on one screen", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    key: `claude:session-${i}`,
  }))
  const names = catNames(many)
  assert.equal(new Set(names.values()).size, 30)
  for (const name of names.values()) assert.match(name, /^[가-힣]+냥$/)
  const again = catNames([...many].reverse())
  assert.deepEqual([...again.entries()].sort(), [...names.entries()].sort())
  assert.equal(
    catNames([many[3]]).get(many[3].key),
    catNames([many[3]]).get(many[3].key)
  )
})

test("keeps only a one-line head of a finished session's last answer", () => {
  const now = Date.parse("2026-11-19T11:00:00.000Z")
  const base = {
    key: "claude:s1",
    session: "s1aaaa",
    state: "done",
    updated_at: "2026-11-19T10:59:00.000Z",
  }
  const long = "첫 줄입니다.\n\n둘째 줄  " + "가".repeat(400)
  const [agent] = toSessionAgents(
    {
      agents: [
        { ...base, result: long, result_at: "2026-11-19T10:59:00.000Z" },
      ],
    },
    now
  )
  assert.ok(agent.result.startsWith("첫 줄입니다. 둘째 줄 가"))
  assert.equal(agent.result.length, 160)
  assert.ok(agent.result.endsWith("…"))
  assert.equal(agent.resultAt, "2026-11-19T10:59:00.000Z")
  const [plain] = toSessionAgents({ agents: [base] }, now)
  assert.equal(plain.result, "")
})

test("drops markdown marks from a finished answer's head", () => {
  const now = Date.parse("2026-11-19T11:00:00.000Z")
  const [agent] = toSessionAgents(
    {
      agents: [
        {
          key: "claude:s2",
          session: "s2bbbb",
          state: "done",
          updated_at: "2026-11-19T10:59:00.000Z",
          result:
            "## 요약\n**루프를 멈췄습니다.** `npm test` 통과, a_b.ts 수정",
        },
      ],
    },
    now
  )
  assert.equal(
    agent.result,
    "요약 루프를 멈췄습니다. npm test 통과, a_b.ts 수정"
  )
})

test("drops list markers when a finished answer is joined into one line", () => {
  const now = Date.parse("2026-11-19T11:00:00.000Z")
  const [agent] = toSessionAgents(
    {
      agents: [
        {
          key: "claude:s3",
          session: "s3cccc",
          state: "done",
          updated_at: "2026-11-19T10:59:00.000Z",
          result:
            "이상이 없습니다.\n- 하네스: 통과\n* 테스트 -1건\n2. 빌드 완료",
        },
      ],
    },
    now
  )
  assert.equal(
    agent.result,
    "이상이 없습니다. 하네스: 통과 테스트 -1건 빌드 완료"
  )
})

test("names the home-folder office after the team and keeps repository names", () => {
  assert.equal(officeName("~", "우리 팀"), "우리 팀")
  assert.equal(officeName("myrepo", "우리 팀"), "myrepo")
})

test("shortens a peer name that starts with its own repository", () => {
  assert.equal(
    peerTag({ peerName: "myrepo-21", project: "myrepo" }),
    "21"
  )
  assert.equal(
    peerTag({ peerName: "work-03", project: "myrepo" }),
    "work-03"
  )
  assert.equal(peerTag({ peerName: "", project: "myrepo" }), "")
  assert.equal(
    peerTag({
      peerName: "선넘지말고 기술서 신청서나 완벽하게 만들어라 (Branch)",
      project: "myrepo",
    }),
    "선넘지말고 기술서 신…"
  )
})

test("keeps the last two folders of a long merged room path", () => {
  assert.equal(shortFolder("work"), "work/")
  assert.equal(shortFolder("ledger/apps"), "ledger/apps/")
  assert.equal(shortFolder("프로젝트/회사자료/작업본/심볼"), "…/작업본/심볼/")
})

test("nests offices by where their roots sit on this Mac", () => {
  const roots = [
    "Project/myrepo",
    "",
    "Project",
    "/opt/tool",
    "Project/myrepo-docs",
  ]
  const tree = nestOffices(roots, (root) => root)
  const shape = (nodes) =>
    nodes.map((node) => [node.item, shape(node.children)])
  assert.deepEqual(shape(tree), [
    [
      "",
      [
        [
          "Project",
          [
            ["Project/myrepo", []],
            ["Project/myrepo-docs", []],
          ],
        ],
      ],
    ],
    ["/opt/tool", []],
  ])
})
