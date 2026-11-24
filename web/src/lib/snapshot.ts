// 서버(kttn serve)의 GET /api/snapshot 응답을 화면 자료로 바꾼다. 서버는
// 세션 저장 모양 그대로 보내고, 화면용 이름·상태 판단은 여기서 한다.

import {
  toSessionAgents,
  type OfficeAutomation,
  type OfficeSnapshot,
} from "@/lib/agent-office"

export type OfficeSettings = {
  /** 건물과 홈 폴더 사무실의 이름 */
  officeName: string
  /** 기계실이 들어가는 저장소 이름. 없으면 "". */
  homeRepo: string
  /** 화면 언어(ko·en·ja). 없으면 브라우저 언어를 따른다. */
  lang: string
  /** kttn init을 마쳤는지. 아니면 화면이 설정 안내를 보인다. */
  configured: boolean
}

export type ServerSnapshot = OfficeSnapshot & { settings: OfficeSettings }

const AUTOMATION_STATES = new Set(["running", "ok", "failed", "held"])

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function toAutomations(raw: unknown): OfficeAutomation[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const value = row as Record<string, unknown>
    const state = text(value.state)
    if (!text(value.key) || !AUTOMATION_STATES.has(state)) return []
    return [
      {
        key: text(value.key),
        label: text(value.label),
        state: state as OfficeAutomation["state"],
        heldCount:
          Number.isSafeInteger(value.heldCount) && (value.heldCount as number) > 0
            ? (value.heldCount as number)
            : 0,
        startedAt: text(value.startedAt),
        endedAt: text(value.endedAt) || null,
      },
    ]
  })
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
    automations: toAutomations(body.automations),
    generatedAt,
    settings: {
      officeName: text(settings.officeName),
      homeRepo: text(settings.homeRepo),
      lang: text(settings.lang),
      configured: settings.configured === true,
    },
  }
}

export async function fetchSnapshot() {
  const response = await fetch("/api/snapshot", { cache: "no-store" })
  if (!response.ok) throw new Error(String(response.status))
  return readSnapshot(await response.json())
}
