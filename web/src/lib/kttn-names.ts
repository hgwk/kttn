// 고양이 이름표: 레벨, 세션 이름 꼬리표, 고양이 이름.
import { catWords, t } from "../i18n/index.ts"
import type { SessionAgent } from "./kttn.ts"

/**
 * 도구를 쓴 횟수로 매기는 레벨. 레벨 L에서 L+1로 오르려면 도구를 5×L번 더
 * 써야 한다(0, 5, 15, 30, 50, …). 화면의 경험치 막대가 이 값을 그린다.
 */
export function levelFor(toolCount: number) {
  const count = Math.max(0, Math.floor(toolCount))
  let level = 1
  let floor = 0
  while (count >= floor + 5 * level) {
    floor += 5 * level
    level += 1
  }
  return { level, into: count - floor, need: 5 * level }
}

/**
 * 이름표 옆에 붙이는 세션 이름. 같은 저장소 이름으로 시작하면 그 앞말을
 * 떼어 "work-21"을 "21"로 줄인다.
 */
// 이름표에 붙이는 세션 이름의 최대 글자 수
const PEER_TAG_MAX = 12

export function peerTag(agent: Pick<SessionAgent, "peerName" | "project">) {
  const prefix = `${agent.project}-`
  const tag = agent.peerName.startsWith(prefix)
    ? agent.peerName.slice(prefix.length)
    : agent.peerName
  // 갈래로 나뉜 세션은 이름에 대화 제목이 들어와 길다. 이름표가 책상 폭을
  // 넘지 않게 줄이고, 전체 이름은 이름표의 title로 보인다.
  return tag.length > PEER_TAG_MAX ? `${tag.slice(0, PEER_TAG_MAX - 1)}…` : tag
}

/** 직전 화면과 지금 화면을 비교해 레벨이 오른 세션 키를 돌려준다. */
export function levelUpKeys(prev: SessionAgent[], next: SessionAgent[]) {
  const before = new Map(prev.map((agent) => [agent.key, agent.toolCount]))
  return next.flatMap((agent) => {
    const old = before.get(agent.key)
    return old !== undefined &&
      levelFor(agent.toolCount).level > levelFor(old).level
      ? [agent.key]
      : []
  })
}

function wordIndex(key: string) {
  let hash = 0
  for (const char of key) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return hash % catWords().length
}

/** 다른 고양이와 겹치는지 따지지 않은 세션 키의 기본 고양이 이름(도감 등) */
export function baseCatName(key: string) {
  return t("cat.name", { word: catWords()[wordIndex(key)] })
}

/**
 * 세션마다 고양이 이름을 붙인다. 한 화면에서 겹치지 않게 고르고, 한 번 정한
 * 이름은 그 세션이 화면에 있는 동안 바꾸지 않는다(다른 세션이 늘거나 줄어도).
 * - keep: 앞서 정한 이름(세션 키 → 단어 번호). 이번에 정한 것으로 고쳐 둔다.
 *   화면에서 사라진 세션은 지운다.
 * - recorded: 서버 도감에 남은 처음 이름(세션 키 → 이름). 지금 언어의 단어로
 *   읽히면 새로 정할 때 그 단어를 먼저 쓴다.
 * - revisit: keep에 있어도 다시 정해도 되는 세션(도감이 오기 전에 임시로 정한
 *   것). 도감 이름이 비어 있으면 그것으로, 아니면 앞서 정한 이름을 그대로 쓴다.
 * 처음 보는 세션은 키에서 정한 단어를 쓰고, 이미 쓰인 단어면 다음 단어로 넘긴다.
 * keep 없이 부르면 새로 고쳐도 같은 이름이다(키 순서로 정한다).
 */
export function catNames(
  agents: SessionAgent[],
  options: {
    keep?: Map<string, number>
    recorded?: Map<string, string>
    revisit?: Set<string>
  } = {}
) {
  const keep = options.keep ?? new Map<string, number>()
  const words = catWords()
  const named = words.map((word) => t("cat.name", { word }))
  const byName = new Map(named.map((name, index) => [name, index]))
  const keys = agents.map((agent) => agent.key).sort()
  const visible = new Set(keys)
  for (const key of keep.keys()) if (!visible.has(key)) keep.delete(key)
  const used = new Set<number>()
  const chosen = new Map<string, number>()
  // 앞서 정한 이름부터 지킨다.
  for (const key of keys) {
    const index = keep.get(key)
    if (options.revisit?.has(key)) continue
    if (index === undefined || index >= words.length || used.has(index))
      continue
    used.add(index)
    chosen.set(key, index)
  }
  // 새로 정할 세션은 도감 이름, (임시로) 앞서 정한 이름, 키에서 정한 단어
  // 순서로 비어 있는 것을 고른다.
  for (const key of keys) {
    if (chosen.has(key)) continue
    const saved = byName.get(options.recorded?.get(key) ?? "")
    const kept = keep.get(key)
    let index =
      saved !== undefined && !used.has(saved)
        ? saved
        : kept !== undefined && kept < words.length && !used.has(kept)
          ? kept
          : wordIndex(key)
    for (let tries = 0; used.has(index) && tries < words.length; tries++)
      index = (index + 1) % words.length
    used.add(index)
    chosen.set(key, index)
  }
  const names = new Map<string, string>()
  for (const [key, index] of chosen) {
    keep.set(key, index)
    names.set(key, named[index])
  }
  return names
}
