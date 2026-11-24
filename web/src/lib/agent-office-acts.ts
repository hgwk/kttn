// 고양이의 짧은 행동과 말(쉬는 활동, 도구 실패 같은 순간, 멈춘 까닭, 다른
// 세션에게 얘기하러 가기, 모델 이름). 대사(cat-speech)와 그림(office-canvas)이
// 같은 함수로 고르므로 둘이 어긋나지 않는다. 세션 자료 자체는 agent-office.ts.
import { t, type MessageKey } from "../i18n/index.ts"
import type { SessionAgent } from "./agent-office.ts"

// FNV-1a. 31을 곱하는 해시는 끝 글자만 다른 key끼리 늘 같은 일을 골랐다.
function fnv(text: string) {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** 쉬는 고양이가 할 일을 바꾸는 간격(ms) */
export const IDLE_SLOT_MS = 60_000

export type IdleActivity =
  | "doze"
  | "stroll"
  | "groom"
  | "window"
  | "tower"
  | "prop"

/** 쉬는 고양이 둘레에 있는 것: 캣타워가 있는지, 찾아갈 소품이 몇 개인지. */
export type Nearby = { tower: boolean; props: number }
const IDLE_ACTIVITIES: IdleActivity[] = ["doze", "stroll", "groom", "window"]
/** 산책은 1분 가운데 처음 이만큼(ms)만 한다. 돌아와 앉은 뒤에는 존다. */
export const STROLL_MS = 14_000
/**
 * 산책은 1분의 처음 이만큼(ms) 안에서만 나선다. 한 바퀴(약 10초)가 STROLL_MS
 * 안에 끝나야 대사("돌고 오겠다냥")와 걸음이 어긋나지 않는다.
 */
export const STROLL_START_MS = 3_000
/** 캣타워에 올라가 앉은 걸 보이기 전, 걸어가는 데 걸리는 시간(ms) */
export const TOWER_WALK_MS = 4_000

/**
 * 오래 쉬는(sleeping) 고양이가 지금 하는 일. 1분마다 고양이마다 다르게 고른다.
 * 쉬는 중이 아니면 "". 대사와 그림이 같은 값을 쓰므로 둘이 어긋나지 않는다.
 */
export function idleActivity(
  agent: Pick<SessionAgent, "key" | "state">,
  now: number,
  /**
   * 같은 책상 구역 휴게 공간에 캣타워가 있으면 캣타워에도 올라간다. 찾아갈
   * 소품(밥그릇, 해먹 등)이 있으면 졸 차례에 가끔 그 소품에 간다("prop").
   */
  tower: boolean | Nearby = false,
  /**
   * 같은 책상 구역 고양이들. 주면 쉬는 고양이끼리 차례로 다른 일을 나눠
   * 가진다(활동 수보다 많으면 그때부터 겹친다). 안 주면 고양이마다 따로 고른다.
   */
  mates?: readonly Pick<SessionAgent, "key" | "state">[],
  /**
   * 산책 차례인데 걷지 않을 때(산책 출발 시각을 지나 화면을 연 경우) true.
   * 산책을 다녀온 뒤처럼 바로 다른 일을 한다.
   */
  walkedOff = false
): IdleActivity | "" {
  if (agent.state !== "sleeping") return ""
  const slot = Math.floor(now / IDLE_SLOT_MS)
  const hasTower = typeof tower === "boolean" ? tower : tower.tower
  const props = typeof tower === "boolean" ? 0 : tower.props
  // 졸 차례 셋 가운데 둘은 찾아갈 소품이 있으면 그 소품에 간다. 캣타워 차례와
  // 다른 고양이 몫은 그대로라 휴게 공간 그림(visit-cats.tsx)과 어긋나지 않는다.
  const visit = (act: IdleActivity): IdleActivity =>
    act === "doze" && props > 0 && fnv(`${agent.key}:${slot}:visit`) % 3 !== 0
      ? "prop"
      : act
  const choices: IdleActivity[] = hasTower
    ? [...IDLE_ACTIVITIES, "tower"]
    : IDLE_ACTIVITIES
  const sleepers = (mates ?? [])
    .filter((mate) => mate.state === "sleeping")
    .map((mate) => mate.key)
    .sort()
  const seat = sleepers.indexOf(agent.key)
  const base =
    seat >= 0
      ? fnv(`${sleepers.join(",")}:${slot}`) + seat
      : fnv(`${agent.key}:${slot}`)
  const picked = choices[base % choices.length]
  if (picked !== "stroll" || (now % IDLE_SLOT_MS < STROLL_MS && !walkedOff))
    return visit(picked)
  // 산책은 잠깐이라, 다녀온 뒤에도(또는 나서지 못했으면) "돌고 오겠다냥"라고
  // 하지 않게 남은 시간은 다른 일을 한다. 같은 구역에 아무도 안 고른 일이 남았으면 그것을 하고
  // (옆 고양이와 똑같이 졸지 않게), 고양이가 많아 다 찼으면 졸기가 몰리지
  // 않게 털 고르기·창밖 구경을 번갈아 한다. 걸어가야 하는 캣타워는 뺀다.
  const spare =
    seat < 0
      ? "doze"
      : sleepers.length < choices.length
        ? choices[(base - seat + sleepers.length) % choices.length]
        : seat % 2
          ? "groom"
          : "window"
  return spare === "groom" || spare === "window" ? spare : visit("doze")
}

/** 소품을 찾아가는 고양이가 이번 1분에 고르는 소품 차례(count개 가운데). */
export function propPick(key: string, now: number, count: number) {
  return count > 0
    ? fnv(`${key}:${Math.floor(now / IDLE_SLOT_MS)}:spot`) % count
    : 0
}

/** 도구 실패 같은 순간을 이만큼(ms) 보인다. */
export const MOMENT_MS = 4_000

/** 최근 MOMENT_MS 안에 일어난 그 종류의 순간이면 그 순간, 아니면 null. */
export function recentMoment(
  agent: Pick<SessionAgent, "moment">,
  kind: string,
  now: number
) {
  const moment = agent.moment
  if (!moment || moment.kind !== kind) return null
  const since = now - Date.parse(moment.at)
  return since >= 0 && since < MOMENT_MS ? moment : null
}

// 멈춘 까닭을 쉬운 말로 바꾼다.
const TROUBLE_KINDS = new Set([
  "rate_limit",
  "server_error",
  "overloaded",
  "authentication_failed",
  "billing_error",
])

/** 모델 이름을 짧게: claude-opus-5-5 → opus 5.5. 모르면 "". */
export function modelLabel(model: string) {
  // 이름-주버전-부버전 뒤에 붙은 말(luna 등)은 띄어 남긴다.
  return model
    .replace(/^claude-/, "")
    .replace(/^([a-z]+)-(\d+)(?:-(\d+))?/, (_, name, major, minor) =>
      minor ? `${name} ${major}.${minor}` : `${name} ${major}`
    )
    .replace(/-/g, " ")
}

/** 오류로 멈춘 고양이의 대사. 멈추지 않았으면 "". */
export function troubleText(trouble: string) {
  if (!trouble) return ""
  return TROUBLE_KINDS.has(trouble)
    ? t(`trouble.${trouble}` as MessageKey)
    : t("trouble.other", { kind: trouble })
}

/** 메시지를 보낸 뒤 이만큼(ms) 그 세션에게 가서 얘기하는 모습을 보인다. */
export const VISIT_MS = 10_000

/** 지금 다른 세션에게 가서 얘기하는 중이면 그 세션 이름, 아니면 빈 문자열. */
export function visitingName(
  agent: Pick<SessionAgent, "visitTo" | "visitAt" | "state">,
  now: number
) {
  if (!agent.visitTo || agent.state === "ended") return ""
  const since = now - Date.parse(agent.visitAt)
  return since >= 0 && since < VISIT_MS ? agent.visitTo : ""
}
