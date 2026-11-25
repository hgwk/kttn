

import { createContext, useContext } from "react"

import type { SessionAgent } from "@/lib/kttn"

// 화면 전체의 고양이 이름표. KttnView가 catNames()로 채운다.
export const CatNamesContext = createContext<Map<string, string>>(new Map())

/** 세션의 고양이 이름. 이름표에 없으면 세션 앞자리를 쓴다. */
export function useCatName(agent: SessionAgent) {
  return useContext(CatNamesContext).get(agent.key) ?? agent.sessionShort
}

export function useCatNames() {
  return useContext(CatNamesContext)
}
