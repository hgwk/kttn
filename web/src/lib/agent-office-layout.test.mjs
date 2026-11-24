import assert from "node:assert/strict"
import test from "node:test"

import { folderTree, repoOffices } from "./agent-office-layout.ts"

function agent(key, project, folder, state = "editing", root = "") {
  return { key, project, folder, state, root }
}

test("sessions split into one office per repository", () => {
  const offices = repoOffices([
    agent("a", "myrepo", "ledger"),
    agent("b", "geektv", ""),
    agent("c", "myrepo", ""),
  ])
  assert.deepEqual(
    offices.map((office) => [office.project, office.agents.map((a) => a.key)]),
    [
      ["geektv", ["b"]],
      ["myrepo", ["c", "a"]],
    ]
  )
})

test("an office with a waiting session comes first", () => {
  const offices = repoOffices([
    agent("a", "alpha", ""),
    agent("b", "zulu", "", "needs_you"),
  ])
  assert.equal(offices[0].project, "zulu")
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

test("empty input gives no offices and a bare tree", () => {
  assert.deepEqual(repoOffices([]), [])
  assert.deepEqual(folderTree("x", []), {
    name: "x",
    path: "",
    agents: [],
    children: [],
  })
})

test("same-named repositories in different places get their own offices", () => {
  const offices = repoOffices([
    agent("a", "site", "", "editing", "Project/site"),
    agent("b", "site", "", "editing", "Archive/site"),
    agent("c", "myrepo", "", "editing", "Project/myrepo"),
    agent("d", "myrepo", "ledger"),
  ])
  assert.deepEqual(
    offices.map((office) => [
      office.project,
      office.root,
      office.agents.map((a) => a.key),
    ]),
    [
      ["myrepo", "Project/myrepo", ["c", "d"]],
      ["site", "Archive/site", ["b"]],
      ["site", "Project/site", ["a"]],
    ]
  )
})

test("a session without root stays apart when the name is ambiguous", () => {
  const offices = repoOffices([
    agent("a", "site", "", "editing", "Project/site"),
    agent("b", "site", "", "editing", "Archive/site"),
    agent("c", "site", ""),
  ])
  assert.equal(offices.length, 3)
  assert.equal(offices.find((office) => office.root === "").agents[0].key, "c")
})
