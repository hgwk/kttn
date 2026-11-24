import { t } from "@/i18n"
import { PixelIcon } from "@/office/pixel-icon"
import { AutomationCanvas } from "@/office/automation-canvas"
import { MAX_STATIONS } from "@/office/automation-draw"
import { GameWindow } from "@/office/game-ui"
import { RoomFrame } from "@/office/room-frame"
import {
  byAutomationAttention,
  type OfficeAutomation,
} from "@/lib/agent-office"
import { cn } from "@/lib/utils"

function ago(iso: string, now: number) {
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ""
  if (ms < 60_000) return t("ago.justNow")
  if (ms < 3_600_000) return t("ago.minutes", { n: Math.floor(ms / 60_000) })
  return t("ago.hours", { n: Math.floor(ms / 3_600_000) })
}

const automationLabel = (state: OfficeAutomation["state"]) =>
  t(`automation.${state}`)

/**
 * 기계실 방. 자동화 실행 하나가 단말 하나이고, 아래 목록이 같은 번호로
 * 무엇인지 적는다. 설정한 홈 저장소의 사무실 안에 방으로 들어간다.
 */
export function MachineRoom({
  automations,
  now,
}: {
  automations: OfficeAutomation[]
  now: number
}) {
  const ordered = byAutomationAttention(automations)
  return (
    <RoomFrame
      id="office-automations"
      label={t("automation.machineRoom")}
      ariaLabel={t("automation.machineRoomLabel", { n: ordered.length })}
      floor="check"
      alert={ordered.some((automation) => automation.state === "failed")}
      tags={
        <span className="bg-[#2b2a36]/80 px-1 py-px text-xs text-[#f7f2e8]">
          {t("automation.recent")}
        </span>
      }
    >
      <div className="grid w-[300px] max-w-full gap-2">
        <AutomationCanvas automations={ordered} />
        {ordered.length === 0 ? (
          <p className="border-2 border-[#2b2a36] bg-[#fffdf7] px-2 py-1 text-xs text-[#2b2a36]">
            {t("automation.none")}
          </p>
        ) : (
          <ul className="grid gap-1 text-xs text-[#2b2a36]">
            {ordered.map((automation, index) => (
              <li
                key={automation.key}
                className={cn(
                  "flex items-center justify-between gap-2 border-2 bg-[#fffdf7] px-1.5 py-1",
                  automation.state === "failed"
                    ? "border-red-500"
                    : "border-[#2b2a36]"
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 bg-[#2b2a36] px-1 text-[#f7f2e8]">
                    {index < MAX_STATIONS ? index + 1 : "-"}
                  </span>
                  <span className="truncate">{automation.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[#6b6a80]">
                  <span
                    className={cn(
                      "px-1",
                      automation.state === "failed" && "bg-red-500 text-white",
                      // 판정 보류는 장애가 아니므로 빨강 대신 쉬는 색을 쓴다.
                      automation.state === "held" &&
                        "bg-[#8fa0b8] text-[#2b2a36]",
                      automation.state === "running" &&
                        "bg-[#4caf5f] text-white"
                    )}
                  >
                    {automation.state === "held" && automation.heldCount > 0
                      ? t("automation.heldCount", { n: automation.heldCount })
                      : automationLabel(automation.state)}
                  </span>
                  {ago(automation.endedAt ?? automation.startedAt, now)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RoomFrame>
  )
}

/** 콘솔 저장소의 사무실이 화면에 없을 때 기계실을 담는 창. */
export function AutomationRoom({
  automations,
  now,
}: {
  automations: OfficeAutomation[]
  now: number
}) {
  return (
    <GameWindow
      labelledBy="office-automations-window"
      title={
        <span className="inline-flex items-center gap-1.5">
          <PixelIcon name="gear" />
          {t("automation.room")}
        </span>
      }
    >
      <MachineRoom automations={automations} now={now} />
    </GameWindow>
  )
}
