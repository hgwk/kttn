// 저장소별 사무실과 폴더 상하 관계를 만든다. 화면은 이 결과를 그리기만 한다.
import type { SessionAgent } from "@/lib/agent-office"

export type RepoOffice = {
  project: string
  /** 사무실이 놓인 경로(홈 기준). 아는 세션이 없으면 "". */
  root: string
  agents: SessionAgent[]
  tree: FolderNode
}

export type FolderNode = {
  name: string
  path: string
  agents: SessionAgent[]
  children: FolderNode[]
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** 폴더 경로를 따라 트리를 만든다. 세션은 자기가 있는 폴더 마디에 붙는다. */
export function folderTree(project: string, agents: SessionAgent[]) {
  const root: FolderNode = { name: project, path: "", agents: [], children: [] }
  for (const agent of agents) {
    let node = root
    const parts = agent.folder.split("/").filter(Boolean)
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/")
      let child = node.children.find((candidate) => candidate.path === path)
      if (!child) {
        child = { name: part, path, agents: [], children: [] }
        node.children.push(child)
        node.children.sort((a, b) => byText(a.name, b.name))
      }
      node = child
    })
    node.agents.push(agent)
  }
  return root
}

/**
 * 세션을 저장소별 사무실로 나눈다. 사무실은 저장소가 놓인 경로(root)로
 * 가르므로, 다른 곳에 있는 같은 이름의 저장소는 따로 선다. root를 아직
 * 모르는 세션(예전 훅)은 같은 이름의 사무실이 하나뿐이면 그리로 들어간다.
 * 같은 폴더의 세션이 이웃 책상에 앉도록 폴더 경로 순서로 세운다. 확인이
 * 필요한 세션이 있는 사무실을 먼저 둔다.
 */
export function repoOffices(agents: SessionAgent[]): RepoOffice[] {
  const groups = new Map<
    string,
    { project: string; root: string; agents: SessionAgent[] }
  >()
  const add = (key: string, agent: SessionAgent) => {
    const group = groups.get(key) ?? {
      project: agent.project,
      root: agent.root,
      agents: [],
    }
    group.agents.push(agent)
    groups.set(key, group)
  }
  const rootless: SessionAgent[] = []
  for (const agent of agents) {
    if (agent.root) add(`root:${agent.root}`, agent)
    else rootless.push(agent)
  }
  for (const agent of rootless) {
    const same = [...groups.entries()].filter(
      ([key, group]) =>
        key.startsWith("root:") && group.project === agent.project
    )
    add(same.length === 1 ? same[0][0] : `project:${agent.project}`, agent)
  }
  return [...groups.values()]
    .map(({ project, root, agents: list }) => {
      const sorted = [...list].sort(
        (a, b) => byText(a.folder, b.folder) || byText(a.key, b.key)
      )
      return {
        project,
        root,
        agents: sorted,
        tree: folderTree(project, sorted),
      }
    })
    .sort((a, b) => {
      const waitA = a.agents.some((agent) => agent.state === "needs_you")
      const waitB = b.agents.some((agent) => agent.state === "needs_you")
      if (waitA !== waitB) return waitA ? -1 : 1
      return byText(a.project, b.project) || byText(a.root, b.root)
    })
}
