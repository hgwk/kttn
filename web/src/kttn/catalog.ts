import { useSyncExternalStore } from "react"

// 서버 도감(/api/cats)의 마지막으로 읽은 값. 도감 창(cat-book.tsx)이 읽어 와
// 넣고, 이름표 칭호(desk-tag.tsx)처럼 다른 곳은 여기서 꺼내 쓴다.

export type CatRecord = {
  key: string
  source: string
  project: string
  folder: string
  model: string
  /** 세션 이름(work-eb 같은 것, 최근 값) */
  session_name: string
  /** 처음 붙은 고양이 이름(화면이 알려 준 값). 없으면 빈 문자열 */
  cat_name: string
  first_seen: string
  last_seen: string
  tools: number
  /** 새벽(서버 시각 0~5시)에 일한 적이 있는지. 이전 서버에는 없다. */
  night_owl?: boolean
  /** 그날의 집계(date는 이 컴퓨터 날짜). 이전 서버에는 없다. */
  day?: { date: string; tools: number; failures: number }
}

/** 동시에 일한 고양이 수의 최고 기록. 이전 서버에는 없다. */
export type Peak = { count: number; at: string }

export type Catalog = { cats: CatRecord[]; peak?: Peak }

let catalog: Catalog | null = null
let byKey = new Map<string, CatRecord>()
const listeners = new Set<() => void>()

export function setCatalog(next: Catalog | null) {
  catalog = next
  byKey = new Map((next?.cats ?? []).map((cat) => [cat.key, cat]))
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 도감 전체(서버에 도감이 없거나 아직 못 읽었으면 null) */
export const useCatalog = () =>
  useSyncExternalStore(subscribe, () => catalog, () => null)

/** 세션 하나의 도감 기록 */
export const useCatRecord = (key: string) =>
  useSyncExternalStore(subscribe, () => byKey.get(key), () => undefined)
