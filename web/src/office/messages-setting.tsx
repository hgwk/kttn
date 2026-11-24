import { createContext, useContext } from "react"

// 말풍선에서 세션에 메시지를 보내는 기능이 켜져 있는지(설정 messages).
// 꺼져 있으면 말풍선을 눌러도 입력칸 대신 켜는 방법만 안내한다.
export const MessagesContext = createContext(false)

export function useMessagesOn() {
  return useContext(MessagesContext)
}
