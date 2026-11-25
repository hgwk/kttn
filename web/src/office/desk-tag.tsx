import { t, type MessageKey } from "@/i18n"
import {
  familyColor,
  seatFor,
  type OfficeLayout,
} from "@/office/office-draw"
import { levelFor, peerTag, type SessionAgent } from "@/lib/agent-office"
import { modelLabel } from "@/lib/agent-office-acts"
import { titlesFor } from "@/lib/agent-office-titles"
import { useCatRecord } from "@/office/catalog"
import { seatBox } from "@/office/seat-draw"

/**
 * 책상 앞 이름표. 고양이 이름(세션들이 부르는 이름), 레벨, 할 일 수를 단다.
 * 캔버스 위에 둥근모꼴 글자로 얹는다(캔버스에 작은 한글을 그리면 번진다).
 */
export function DeskTag({
  agent,
  name,
  layout,
  index,
}: {
  agent: SessionAgent
  name: string
  layout: OfficeLayout
  index: number
}) {
  const seat = seatFor(layout, index)
  // 자유 자리면 그 그림 바로 아래, 책상이면 책상 앞에 단다.
  const free = seatBox(layout, index, agent.key)
  const at = free
    ? { x: free.cx, y: free.bottom + 1 }
    : { x: seat.x, y: seat.y + 21 }
  const record = useCatRecord(agent.key)
  const titles = titlesFor(
    {
      tools: Math.max(agent.toolCount, record?.tools ?? 0),
      firstSeen: record?.first_seen,
      nightOwl: record?.night_owl,
    },
    Date.now()
  )
  const top = titles[0]
  return (
    <span
      aria-hidden="true"
      // 세션이 쓰는 모델은 마우스를 올리면 보인다(이름표가 길어지지 않게).
      title={
        agent.model ? t("desk.model", { model: modelLabel(agent.model) }) : undefined
      }
      className="absolute z-40 -translate-x-1/2 px-1 text-[11px] leading-[14px] whitespace-nowrap text-white"
      style={{
        left: `${(at.x / layout.w) * 100}%`,
        top: `${(at.y / layout.h) * 100}%`,
        backgroundColor:
          agent.state === "ended" ? "#9ca3af" : familyColor(agent.family),
      }}
    >
      {name}
      {/* 세션들이 서로 부르는 이름. 메시지를 보낼 때 이 이름을 쓴다. */}
      {peerTag(agent) ? (
        <span title={agent.peerName}>({peerTag(agent)})</span>
      ) : null}
      <span className="ml-1 opacity-80">
        Lv.{levelFor(agent.toolCount).level}
      </span>
      {/* 가장 높은 칭호 하나(도감 기록과 지금 도구 수로, 전부는 도감에) */}
      {top ? (
        <span
          title={titles
            .map((id) => t(`title.${id}` as MessageKey))
            .join(", ")}
          className="pointer-events-auto ml-1 bg-amber-300 px-0.5 text-[#2b2a36]"
        >
          {t(`title.${top}` as MessageKey)}
        </span>
      ) : null}
      {/* 세션이 만든 할 일. 마우스를 올리면 목록이 보인다. */}
      {agent.tasks.length ? (
        <span
          title={agent.tasks
            .map((task) => `${task.done ? "☑" : "☐"} ${task.subject}`)
            .join("\n")}
          className="pointer-events-auto ml-1 bg-white/25 px-0.5"
        >
          {t("desk.tasks", {
            done: agent.tasks.filter((task) => task.done).length,
            total: agent.tasks.length,
          })}
        </span>
      ) : null}
    </span>
  )
}
