// 폴더 트리와 사무실 겹침, 사무실 이름. 화면은 이 결과를 그리기만 한다.
import type { SessionAgent } from "./agent-office.ts"

type TreeNode = {
  name: string
  path: string
  agents: SessionAgent[]
  children: TreeNode[]
}

/**
 * 세션이 없고 하위 폴더가 하나뿐인 폴더를 아래 폴더와 합쳐
 * `ledger/apps/pr-console`처럼 한 줄로 보인다. 루트는 합치지 않는다.
 */
export function compactFolderTree<T extends TreeNode>(root: T): T {
  const squash = (node: TreeNode): TreeNode => {
    let current = node
    let name = node.name
    while (current.agents.length === 0 && current.children.length === 1) {
      current = current.children[0]
      name = `${name}/${current.name}`
    }
    return { ...current, name, children: current.children.map(squash) }
  }
  return { ...root, children: root.children.map(squash) } as T
}

/**
 * 이름표용 폴더 경로. 한 줄로 이어진 폴더가 한 방으로 합쳐져 길어지면
 * 마지막 두 폴더만 남겨 "…/재품로고/심볼/"처럼 줄인다. 끝에 "/"를 붙인다.
 */
export function shortFolder(path: string) {
  const parts = path.split("/").filter(Boolean)
  const shown = parts.length > 2 ? ["…", ...parts.slice(-2)] : parts
  return `${shown.join("/")}/`
}

export type OfficeNest<T> = { item: T; children: OfficeNest<T>[] }

// a 경로 안에 b 경로가 들어 있는지. 홈("")은 홈 밖 절대 경로를 뺀 전부를 감싼다.
function encloses(a: string, b: string) {
  if (a === b) return false
  if (a === "") return !b.startsWith("/")
  return b.startsWith(`${a}/`)
}

/**
 * 사무실(저장소)을 이 PC의 폴더 위치대로 겹친다. 다른 사무실 경로 안에 있는
 * 사무실은 가장 가까운 바깥 사무실의 안쪽 사무실이 된다. 순서는 받은 순서를 따른다.
 */
export function nestOffices<T>(items: T[], rootOf: (item: T) => string) {
  const nodes = items.map((item) => ({ item, children: [] as OfficeNest<T>[] }))
  const top: OfficeNest<T>[] = []
  for (const node of nodes) {
    const root = rootOf(node.item)
    const parent = nodes
      .filter((other) => encloses(rootOf(other.item), root))
      .sort((a, b) => rootOf(b.item).length - rootOf(a.item).length)[0]
    if (parent) parent.children.push(node)
    else top.push(node)
  }
  return top
}

/**
 * 사무실을 가리키는 키. 같은 이름의 저장소가 다른 경로에 있을 수 있으므로
 * 경로(root)를 쓰고, 경로가 없는 홈 사무실은 이름("~")을 쓴다.
 */
export function officeKey(office: { root: string; project: string }) {
  return office.root || office.project
}

/**
 * 화면에 보이는 사무실 이름. 홈 폴더 세션(훅이 "~"로 보냄)의 사무실은 다른
 * 사무실을 모두 감싸는 건물 자체이므로 팀 이름으로 부른다.
 */
export function officeName(project: string, buildingName: string) {
  return project === "~" ? buildingName : project
}
