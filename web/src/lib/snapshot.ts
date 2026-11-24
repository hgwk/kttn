// 서버(kttn serve)의 GET /api/snapshot 응답을 화면 자료로 바꾼다. 서버는
// 세션 저장 모양 그대로 보내고, 화면용 이름·상태 판단은 여기서 한다.

import { apiFetch } from "@/lib/screen-key"
import { toSessionAgents, type OfficeSnapshot } from "@/lib/agent-office"

export type OfficeSettings = {
  /** 건물과 홈 폴더 사무실의 이름 */
  officeName: string
  /** 화면 언어(ko·en·ja). 없으면 브라우저 언어를 따른다. */
  lang: string
  /** kttn init을 마쳤는지. 아니면 화면이 설정 안내를 보인다. */
  configured: boolean
  /** 말풍선에서 세션에 메시지를 보낼 수 있는지(기본 꺼짐) */
  messages: boolean
}

export type ServerSnapshot = OfficeSnapshot & { settings: OfficeSettings }

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function readSnapshot(raw: unknown): ServerSnapshot {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const generatedAt = text(body.generatedAt) || new Date().toISOString()
  const settings = (body.settings ?? {}) as Record<string, unknown>
  return {
    agents: toSessionAgents(body, Date.parse(generatedAt)),
    generatedAt,
    settings: {
      officeName: text(settings.officeName),
      lang: text(settings.lang),
      configured: settings.configured === true,
      messages: settings.messages === true,
    },
  }
}

/** 화면 열쇠가 없거나 틀려 서버가 거절했다. */
export class KeyError extends Error {}

export async function fetchSnapshot() {
  const response = await apiFetch("/api/snapshot", { cache: "no-store" })
  if (response.status === 401) throw new KeyError()
  if (!response.ok) throw new Error(String(response.status))
  return readSnapshot(await response.json())
}
