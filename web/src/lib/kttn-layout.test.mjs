import assert from "node:assert/strict"
import test from "node:test"

import { folderTree, repoAreas } from "./kttn-layout.ts"

function agent(key, project, folder, state = "editing", root = "") {
  return { key, project, folder, state, root }
}

test("sessions split into one area per repository", () => {
  const areas = repoAreas([
    agent("a", "myrepo", "ledger"),
    agent("b", "geektv", ""),
    agent("c", "myrepo", ""),
  ])
  assert.deepEqual(
    areas.map((area) => [area.project, area.agents.map((a) => a.key)]),
    [
      ["geektv", ["b"]],
      ["myrepo", ["c", "a"]],
    ]
  )
})

test("an area with a waiting session comes first", () => {
  const areas = repoAreas([
    agent("a", "alpha", ""),
    agent("b", "zulu", "", "needs_you"),
  ])
  assert.equal(areas[0].project, "zulu")
})

test("folder tree nests sessions under their folders", () => {
  const tree = folderTree("myrepo", [
    agent("root", "myrepo", ""),
    agent("console", "myrepo", "ledger/apps/console"),
    agent("ledger", "myrepo", "ledger"),
    agent("work", "myrepo", "work"),
  ])
  assert.deepEqual(
    tree.agents.map((a) => a.key),
    ["root"]
  )
  assert.deepEqual(
    tree.children.map((c) => c.name),
    ["ledger", "work"]
  )
  const ledger = tree.children[0]
  assert.deepEqual(
    ledger.agents.map((a) => a.key),
    ["ledger"]
  )
  const apps = ledger.children[0]
  assert.equal(apps.path, "ledger/apps")
  assert.deepEqual(apps.agents, [])
  assert.equal(apps.children[0].path, "ledger/apps/console")
  assert.deepEqual(
    apps.children[0].agents.map((a) => a.key),
    ["console"]
  )
})

test("empty input gives no areas and a bare tree", () => {
  assert.deepEqual(repoAreas([]), [])
  assert.deepEqual(folderTree("x", []), {
    name: "x",
    path: "",
    agents: [],
    children: [],
  })
})

test("same-named repositories in different places get their own areas", () => {
  const areas = repoAreas([
    agent("a", "site", "", "editing", "Project/site"),
    agent("b", "site", "", "editing", "Archive/site"),
    agent("c", "myrepo", "", "editing", "Project/myrepo"),
    agent("d", "myrepo", "ledger"),
  ])
  assert.deepEqual(
    areas.map((area) => [
      area.project,
      area.root,
      area.agents.map((a) => a.key),
    ]),
    [
      ["myrepo", "Project/myrepo", ["c", "d"]],
      ["site", "Archive/site", ["b"]],
      ["site", "Project/site", ["a"]],
    ]
  )
})

test("a session without root stays apart when the name is ambiguous", () => {
  const areas = repoAreas([
    agent("a", "site", "", "editing", "Project/site"),
    agent("b", "site", "", "editing", "Archive/site"),
    agent("c", "site", ""),
  ])
  assert.equal(areas.length, 3)
  assert.equal(areas.find((area) => area.root === "").agents[0].key, "c")
})
