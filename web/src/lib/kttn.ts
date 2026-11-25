// kttn 화면의 자료 모양과 상태 이름. 실시간 세션 상태는
// 서버(kttn serve)가 훅 신호를 받아 들고 있고, 이 모듈은 그것을 화면용으로
// 바꾸기만 한다.

import { t } from "../i18n/index.ts"

export const AGENT_STATES = [
  "idle",
  "thinking",
  "reading",
  "editing",
  "running",
  "browsing",
  "delegating",
  "working",
  "needs_you",
  "done",
  "sleeping",
  "ended",
] as const

export type AgentState = (typeof AGENT_STATES)[number]

export type SessionAgent = {
  key: string
  family: string
  project: string
  folder: string
  sessionShort: string
  /** 세션들이 서로 부르는 이름(work-21 등). 없으면 빈 문자열. */
  peerName: string
  /** 저장소(구역) 루트의 홈 기준 경로. 홈은 "", 홈 밖은 "/"로 시작한다. */
  root: string
  state: AgentState
  stateLabel: string
  detail: string
  minions: { id: string; label: string }[]
  toolCount: number
  statusSince: string
  updatedAt: string
  /** 마지막으로 일을 끝냈을 때 답변의 앞부분 한 줄. 없으면 빈 문자열. */
  result: string
  resultAt: string
  /** 마지막으로 메시지를 보낸 세션 이름과 보낸 시각. 없으면 빈 문자열. */
  visitTo: string
  visitAt: string
  /** 마지막 순간(도구 실패·맥락 정리 등). at이 바뀔 때 한 번 연출한다. */
  moment: { kind: string; detail: string; at: string } | null
  /** 오류로 멈춘 종류(rate_limit 등). 다음 지시까지 남는다. 없으면 "". */
  trouble: string
  /** 맥락을 정리(compact)하는 중인지 */
  compacting: boolean
  /** 세션이 쓰는 모델(claude-opus-5-5 등). 모르면 "". */
  model: string
  /** 마지막 세션 시작 방식(startup·resume·clear·compact·fork). 모르면 "". */
  startedAs: string
  /** 세션이 만든 할 일 목록(최대 12개) */
  tasks: { subject: string; done: boolean }[]
}

// 결과 한 줄의 최대 길이. 전체 답변은 받지 않고 앞부분만 보인다.
export const RESULT_MAX = 160

export type KttnSnapshot = {
  agents: SessionAgent[]
  generatedAt: string
}

// 아무 신호 없이 이만큼 지나면 자리에서 조는 모습으로 바꾼다.
export const SLEEP_AFTER_MS = 5 * 60 * 1000

export function agentStateLabel(state: AgentState) {
  return t(`state.${state}`)
}

function isAgentState(value: unknown): value is AgentState {
  return (
    typeof value === "string" &&
    (AGENT_STATES as readonly string[]).includes(value)
  )
}

function text(value: unknown, max = 64) {
  return typeof value === "string" ? value.slice(0, max) : ""
}

/**
 * 세션 저장소의 행 한 건을 화면용으로 바꾼다. 모양이 틀린 행은 버린다.
 * 확인을 기다리는 세션과 퇴근한 세션은 오래돼도 졸지 않는다.
 */
export function toSessionAgent(raw: unknown, now: number): SessionAgent | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const key = text(row.key, 200)
  const session = text(row.session, 200)
  const updatedAt = text(row.updated_at)
  if (!key || !session || !isAgentState(row.state)) return null
  let state: AgentState = row.state
  const updated = Date.parse(updatedAt)
  if (
    state !== "needs_you" &&
    state !== "ended" &&
    Number.isFinite(updated) &&
    now - updated > SLEEP_AFTER_MS
  ) {
    state = "sleeping"
  }
  const minions = Array.isArray(row.minions)
    ? row.minions.flatMap((minion) => {
        if (!minion || typeof minion !== "object") return []
        const item = minion as Record<string, unknown>
        return [{ id: text(item.id, 200), label: text(item.label) }]
      })
    : []
  return {
    key,
    family: text(row.source) || "agent",
    project: text(row.project) || "project",
    folder: text(row.folder, 160),
    sessionShort: session.slice(0, 4),
    peerName: text(row.name, 80),
    root: text(row.root, 300),
    state,
    stateLabel: agentStateLabel(state),
    detail: state === "sleeping" ? "" : text(row.detail),
    minions: state === "ended" ? [] : minions,
    toolCount: typeof row.tool_count === "number" ? row.tool_count : 0,
    statusSince: text(row.status_since),
    updatedAt,
    result: oneLine(row.result, RESULT_MAX),
    resultAt: text(row.result_at),
    visitTo: text(row.visit_to, 80),
    visitAt: text(row.visit_at),
    moment: momentField(row.moment),
    trouble: text(row.trouble, 40),
    compacting: row.compacting === true,
    startedAs: text(row.started_as, 20),
    model: text(row.model, 60),
    tasks: Array.isArray(row.tasks)
      ? row.tasks.flatMap((task) => {
          if (!task || typeof task !== "object") return []
          const item = task as Record<string, unknown>
          return [{ subject: text(item.subject, 80), done: item.done === true }]
        })
      : [],
  }
}

function momentField(value: unknown): SessionAgent["moment"] {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const kind = text(item.kind, 40)
  const at = text(item.at)
  return kind && at ? { kind, detail: text(item.detail), at } : null
}

// 여러 줄 답변을 한 줄로 접고 길면 말줄임표로 자른다. 말풍선에서는 마크다운이
// 그려지지 않으므로 굵게(**)·코드(`)·제목(#) 표시는 걷어낸다.
function oneLine(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  const line = value
    .replace(/\*\*|`/g, "")
    .replace(/(^|\n)\s*#{1,6}\s+/g, "$1")
    // 줄 앞 목록 기호(- * + • 1. 1))는 한 줄로 이으면 "- "로 남아 지운다.
    .replace(/(^|\n)\s*(?:[-*+•]|\d+[.)])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

export function toSessionAgents(raw: unknown, now: number) {
  if (!raw || typeof raw !== "object") return []
  const agents = (raw as Record<string, unknown>).agents
  if (!Array.isArray(agents)) return []
  return agents.flatMap((row) => {
    const agent = toSessionAgent(row, now)
    return agent ? [agent] : []
  })
}

// 목록에서 먼저 볼 순서. 확인을 기다리는 세션이 맨 앞, 퇴근한 세션이 맨 뒤다.
const URGENCY: Record<AgentState, number> = {
  needs_you: 0,
  thinking: 1,
  reading: 1,
  editing: 1,
  running: 1,
  browsing: 1,
  delegating: 1,
  working: 1,
  idle: 2,
  done: 2,
  sleeping: 3,
  ended: 4,
}

/** 지금 상태가 시작된 시각. 조는 상태는 마지막 신호 시각부터 센다. */
export function stateSince(agent: SessionAgent) {
  return agent.state === "sleeping" ? agent.updatedAt : agent.statusSince
}

/** 급한 순서로 세운다. 같은 급이면 그 상태로 오래 있던 세션이 앞이다. */
export function byUrgency(agents: SessionAgent[]) {
  return [...agents].sort((a, b) => {
    const rank = URGENCY[a.state] - URGENCY[b.state]
    if (rank) return rank
    const since = stateSince(a).localeCompare(stateSince(b))
    return since || a.key.localeCompare(b.key)
  })
}

/** 상태가 이어진 시간. "3분째"처럼 쓴다. 시각을 모르면 빈 문자열이다. */
export function stateDuration(since: string, now: number) {
  const ms = now - Date.parse(since)
  if (!Number.isFinite(ms) || ms < 0) return ""
  if (ms < 60_000) return t("duration.justNow")
  if (ms < 3_600_000)
    return t("duration.minutes", { n: Math.floor(ms / 60_000) })
  return t("duration.hours", { n: Math.floor(ms / 3_600_000) })
}

export type KttnCounts = {
  needsYou: number
  busy: number
  waiting: number
  resting: number
  ended: number
}

/** 상단 요약용 상태별 개수. */
export function kttnCounts(agents: SessionAgent[]): KttnCounts {
  const counts = { needsYou: 0, busy: 0, waiting: 0, resting: 0, ended: 0 }
  for (const agent of agents) {
    const rank = URGENCY[agent.state]
    if (rank === 0) counts.needsYou += 1
    else if (rank === 1) counts.busy += 1
    else if (rank === 2) counts.waiting += 1
    else if (rank === 3) counts.resting += 1
    else counts.ended += 1
  }
  return counts
}


export * from "./kttn-tree.ts"
export * from "./kttn-names.ts"
