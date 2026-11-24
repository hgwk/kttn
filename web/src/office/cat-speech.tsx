import { t, type MessageKey } from "@/i18n"
import type { Spots } from "@/office/use-tower"
import { spotFor } from "@/office/visit-sync"
import {
  stateDuration,
  stateSince,
  type SessionAgent,
} from "@/lib/agent-office"
import {
  idleActivity,
  recentMoment,
  troubleText,
  visitingName,
  type IdleActivity,
} from "@/lib/agent-office-acts"
import { cn } from "@/lib/utils"

/** 말풍선 대사. 고양이가 지금 하는 일을 직접 말한다. */
export function speechFor(
  agent: SessionAgent,
  lasted = "",
  activity: IdleActivity | "" = "",
  /** 소품을 찾아간 고양이가 거기서 하는 일(visit-cats.tsx) */
  visit = ""
) {
  const what = agent.detail
  // "3분째"처럼 시간이 흐른 경우만 덧붙인다. "방금부터"는 이 두 대사에서 어색하다.
  const waited = lasted && lasted !== t("duration.justNow") ? lasted : ""
  switch (agent.state) {
    case "editing":
      return what ? t("speech.editingWhat", { what }) : t("speech.editing")
    case "reading":
      return what ? t("speech.readingWhat", { what }) : t("speech.reading")
    case "running":
      return what ? t("speech.runningWhat", { what }) : t("speech.running")
    case "browsing":
      return t("speech.browsing")
    case "thinking":
      return t("speech.thinking")
    case "delegating":
      return agent.minions.length
        ? t("speech.delegatingCount", { n: agent.minions.length })
        : t("speech.delegating")
    case "working":
      return t("speech.working")
    case "needs_you":
      return [
        what ? t("speech.needsYouWhat", { what }) : t("speech.needsYou"),
        waited ? t("speech.waited", { time: waited }) : "",
      ]
        .filter(Boolean)
        .join(" ")
    case "done":
      return agent.result
        ? // 결과 문장이 있으면 그것만 보인다(앞에 "다 했다냥!"을 붙이면 줄만 잡아먹는다).
          agent.result
        : t("speech.done")
    case "idle":
      return t("speech.idle")
    case "sleeping":
      // 오래 쉬면 졸기만 하지 않고 1분마다 다른 일을 한다(idleActivity).
      if (activity === "stroll") return t("speech.stroll")
      if (activity === "groom") return t("speech.groom")
      if (activity === "window") return t("speech.window")
      if (activity === "tower") return t("speech.tower")
      if (activity === "prop" && visit)
        return t(`speech.prop.${visit}` as MessageKey)
      return waited
        ? t("speech.dozingFor", { time: waited })
        : t("speech.dozing")
    case "ended":
      return t("speech.ended")
  }
}

/**
 * 고양이 머리 위 대사 상자. "방금부터 sed 돌리는 중이다냥."처럼 시간과
 * 대사를 한 줄 글로만 보인다. 확인이 필요하면 주황으로 깜빡이고, 레벨이
 * 오르면 앞에 LEVEL UP!을 붙인다. 아래쪽 계단 꼬리가 고양이를 가리킨다.
 */
// 테두리 한 칸. 사무실 화면의 모든 테두리는 고양이 외곽선과 같은 2px(캔버스
// 픽셀 하나)로 맞춘다.
const U = 2

/** 칸 단위로 놓는 픽셀 막대. x는 상자 가운데 기준, y는 상자 아래 끝 기준(아래로 +). */
function Px({
  x,
  y,
  w,
  color,
}: {
  x: number
  y: number
  w: number
  color: string
}) {
  return (
    <span
      aria-hidden="true"
      className="absolute"
      style={{
        left: `calc(50% + ${x * U}px)`,
        bottom: -(y + 1) * U,
        width: w * U,
        height: U,
        backgroundColor: color,
      }}
    />
  )
}

function specialLine(agent: SessionAgent, now: number) {
  const trouble = troubleText(agent.trouble)
  if (trouble) return trouble
  const failed = recentMoment(agent, "PostToolUseFailure", now)
  if (failed)
    return failed.detail === "interrupt"
      ? t("speech.interrupted")
      : t("speech.toolFailed", { tool: failed.detail || t("speech.tool") })
  if (agent.compacting) return t("speech.compacting")
  // 잠깐(MOMENT_MS) 보이는 한마디들
  const brief: [string, (detail: string) => string][] = [
    ["PostCompact", () => t("speech.compacted")],
    // 작업 도중 하위 폴더 지침을 읽을 때도 오므로 "시작"이라 하지 않는다.
    [
      "InstructionsLoaded",
      (d) => t("speech.instructions", { file: d || t("speech.instructionsFile") }),
    ],
    [
      "PostModelSwitch",
      (d) =>
        d ? t("speech.modelSwitchedTo", { model: d }) : t("speech.modelSwitched"),
    ],
    ["ConfigChange", () => t("speech.configChanged")],
  ]
  for (const [kind, line] of brief) {
    const moment = recentMoment(agent, kind, now)
    if (moment) return line(moment.detail)
  }
  const talkingTo = visitingName(agent, now)
  return talkingTo ? t("speech.talkingTo", { name: talkingTo }) : ""
}

export function CatSpeech({
  agent,
  now,
  levelUp,
  tower = false,
  mates,
  strolling = false,
}: {
  agent: SessionAgent
  now: number
  levelUp: boolean
  /** 같은 책상 구역의 캣타워와 찾아갈 소품(쉬는 고양이가 간다) */
  tower?: boolean | Spots
  /** 같은 책상 구역 고양이들(쉬는 고양이끼리 다른 일을 나눠 가진다) */
  mates?: readonly SessionAgent[]
  /** 그림에서 이 고양이가 지금 산책하는 중인지 */
  strolling?: boolean
}) {
  const waiting = agent.state === "needs_you"
  // 평소 대사보다 앞서는 한 줄. 확인 요청이 가장 급하고, 그다음은 오류로
  // 멈춤 → 방금 도구 실패 → 맥락 정리 → 다른 세션에게 얘기하는 중 순이다.
  const special = waiting ? "" : specialLine(agent, now)
  // 산책 차례라도 실제로 걷고 있지 않으면(늦게 열린 화면 등) 다른 쉬는 일을 말한다.
  const activity = idleActivity(agent, now, tower, mates, !strolling)
  // 소품을 찾아갔으면 어느 소품에서 무얼 하는지(그림과 같은 계산)
  const spots = typeof tower === "boolean" ? [] : tower.spots
  const visit =
    activity === "prop"
      ? (spots[spotFor(agent.key, now, spots.length)]?.dataset.visit ?? "")
      : ""
  const lasted = stateDuration(stateSince(agent), now)
  // 시간을 앞에 붙이는 대사. 끝냈거나 퇴근한 뒤에는 "방금부터 다 했다냥"처럼
  // 어색하고, 확인 요청·졸기는 대사 안에서 시간을 말한다.
  const timed = !["done", "ended", "needs_you", "sleeping"].includes(
    agent.state
  )
  const ink = waiting ? "#d97706" : "#2b2a36"
  const fill = waiting ? "#fef3c7" : "#fffdf7"
  const bar = (style: React.CSSProperties) => (
    <span
      aria-hidden="true"
      className="absolute"
      style={{ backgroundColor: ink, ...style }}
    />
  )

  return (
    <div
      title={
        agent.result && agent.state !== "done"
          ? t("speech.lastResult", { result: agent.result })
          : undefined
      }
      className={cn(
        "relative mx-[2px] my-[2px]",
        waiting && "animate-pulse motion-reduce:animate-none",
        agent.state === "ended" && "opacity-60"
      )}
      style={{ backgroundColor: fill }}
    >
      <p className="line-clamp-3 px-1.5 py-0.5 text-[11px] leading-[14px] wrap-anywhere break-keep text-[#2b2a36] group-data-near/speech:line-clamp-none">
        {levelUp ? (
          <span className="mr-1 bg-yellow-400 px-0.5 text-yellow-950">
            LEVEL UP!
          </span>
        ) : null}
        {special ? (
          special
        ) : (
          <>
            {timed && lasted
              ? t("speech.timed", {
                  time: lasted,
                  line: speechFor(agent, lasted, activity, visit) ?? "",
                })
              : speechFor(agent, lasted, activity, visit)}
          </>
        )}
      </p>
      {/* 8비트 테두리: 막대 네 개, 모서리는 한 칸씩 비운다. */}
      {bar({ top: -U, left: 0, right: 0, height: U })}
      {bar({ bottom: -U, left: 0, right: 0, height: U })}
      {bar({ left: -U, top: 0, bottom: 0, width: U })}
      {bar({ right: -U, top: 0, bottom: 0, width: U })}
      {/* 계단 꼬리. 바닥 테두리에 틈을 내 안쪽을 잇고 왼쪽 아래로 좁아진다. */}
      <Px x={-1} y={0} w={2} color={fill} />
      <Px x={-2} y={1} w={1} color={ink} />
      <Px x={-1} y={1} w={1} color={fill} />
      <Px x={0} y={1} w={1} color={ink} />
      <Px x={-2} y={2} w={2} color={ink} />
    </div>
  )
}
