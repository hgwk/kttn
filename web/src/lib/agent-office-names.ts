// 고양이 이름표: 레벨, 세션 이름 꼬리표, 고양이 이름.
import { catWords, t } from "../i18n/index.ts"
import type { SessionAgent } from "./agent-office.ts"

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

/**
 * 세션마다 고양이 이름을 붙인다. 이름은 세션 키에서 정해져 새로 고쳐도 같고,
 * 한 화면에서 겹치면 키 순서대로 다음 단어로 넘긴다.
 */
export function catNames(agents: SessionAgent[]) {
  const names = new Map<string, string>()
  const used = new Set<number>()
  const words = catWords()
  for (const key of agents.map((agent) => agent.key).sort()) {
    let index = wordIndex(key)
    for (let tries = 0; used.has(index) && tries < words.length; tries++)
      index = (index + 1) % words.length
    used.add(index)
    names.set(key, t("cat.name", { word: words[index] }))
  }
  return names
}
