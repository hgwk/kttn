import { createContext, useContext } from "react"

import { t } from "@/i18n"

// 설정에서 온 건물 이름. 하위 부품이 사무실 이름을 정할 때 쓴다.
export type OfficeSettingsValue = { buildingName: string }

export const OfficeSettingsContext = createContext<OfficeSettingsValue>({
  buildingName: "",
})

export function useOfficeSettings() {
  const value = useContext(OfficeSettingsContext)
  return { buildingName: value.buildingName || t("office.defaultName") }
}
