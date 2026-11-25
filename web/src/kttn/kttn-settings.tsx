import { createContext, useContext } from "react"

import { t } from "@/i18n"

// 설정에서 온 건물 이름. 하위 부품이 구역 이름을 정할 때 쓴다.
export type KttnSettingsValue = { buildingName: string }

export const KttnSettingsContext = createContext<KttnSettingsValue>({
  buildingName: "",
})

export function useKttnSettings() {
  const value = useContext(KttnSettingsContext)
  return { buildingName: value.buildingName || t("kttn.defaultName") }
}
