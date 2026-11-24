import { createContext, useContext } from "react"

import { t } from "@/i18n"

// 설정에서 온 건물 이름과 기계실이 들어갈 저장소. 하위 부품이 사무실
// 이름을 정할 때 쓴다.
export type OfficeSettingsValue = { buildingName: string; homeRepo: string }

export const OfficeSettingsContext = createContext<OfficeSettingsValue>({
  buildingName: "",
  homeRepo: "",
})

export function useOfficeSettings() {
  const value = useContext(OfficeSettingsContext)
  return {
    buildingName: value.buildingName || t("office.defaultName"),
    homeRepo: value.homeRepo,
  }
}
