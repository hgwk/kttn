import { createContext, useContext, useEffect, useMemo, useRef } from "react"

import { useCatalog } from "@/kttn/catalog"
import { catNames, type SessionAgent } from "@/lib/kttn"

// 화면 전체의 고양이 이름표. KttnView가 useStableCatNames()로 채운다.
export const CatNamesContext = createContext<Map<string, string>>(new Map())

/** 세션의 고양이 이름. 이름표에 없으면 세션 앞자리를 쓴다. */
export function useCatName(agent: SessionAgent) {
  return useContext(CatNamesContext).get(agent.key) ?? agent.sessionShort
}

export function useCatNames() {
  return useContext(CatNamesContext)
}

// 정한 이름(세션 키 → 단어 번호)을 이 브라우저에 남겨 새로 고쳐도 같게 한다.
const STORE = "kttn.catNames"

function loadKeep() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "{}") as unknown
    if (!raw || typeof raw !== "object") return new Map<string, number>()
    return new Map(
      Object.entries(raw).filter(
        (entry): entry is [string, number] => Number.isInteger(entry[1])
      )
    )
  } catch {
    return new Map<string, number>()
  }
}

/**
 * 보이는 세션들의 고양이 이름. 한 번 정한 이름은 그 세션이 화면에 있는 동안
 * 바뀌지 않는다(새 세션이 들어오거나 나가도). 처음 보는 세션은 서버 도감에
 * 남은 처음 이름이 있으면 그것을 쓴다.
 */
export function useStableCatNames(agents: SessionAgent[]) {
  const keep = useRef<Map<string, number>>(null)
  keep.current ??= loadKeep()
  const catalog = useCatalog()
  const recorded = useMemo(
    () =>
      new Map(
        (catalog?.cats ?? [])
          .filter((cat) => cat.cat_name)
          .map((cat) => [cat.key, cat.cat_name])
      ),
    [catalog]
  )
  const names = catNames(agents, { keep: keep.current, recorded })
  const saved = JSON.stringify(Object.fromEntries(keep.current))
  useEffect(() => {
    try {
      if (localStorage.getItem(STORE) !== saved) localStorage.setItem(STORE, saved)
    } catch {
      // 저장소를 못 쓰면 이 화면에서만 지킨다.
    }
  }, [saved])
  return names
}
