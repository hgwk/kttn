import { t } from "@/i18n"
import {
  AUTOMATION_W,
  MAX_STATIONS,
  stationSpot,
  automationRoomHeight,
  drawAutomationRoom,
} from "@/office/automation-draw"
import { OFFICE_SCALE } from "@/office/pixel"
import { usePixelLoop } from "@/office/use-pixel-loop"
import type { OfficeAutomation } from "@/lib/agent-office"

/** 자동화실 기계들. 실행 하나가 단말 하나이며 목록과 같은 번호로 선다. */
export function AutomationCanvas({
  automations,
}: {
  automations: OfficeAutomation[]
}) {
  const height = automationRoomHeight(automations.length)
  const canvasRef = usePixelLoop(automations, (ctx, current, _dt, t) =>
    drawAutomationRoom(ctx, current, t)
  )
  return (
    <div
      className="relative max-w-full"
      style={{ width: AUTOMATION_W * OFFICE_SCALE }}
    >
      <canvas
        ref={canvasRef}
        width={AUTOMATION_W}
        height={height}
        role="img"
        aria-label={t("automation.canvasLabel", { n: automations.length })}
        className="block h-auto w-full [image-rendering:pixelated]"
      />
      {/* 목록과 같은 번호표. 둥근모꼴 글자로 캔버스 위에 얹는다. */}
      {automations.slice(0, MAX_STATIONS).map((automation, index) => {
        const spot = stationSpot(index)
        return (
          <span
            key={automation.key}
            aria-hidden="true"
            className="absolute -translate-x-1/2 bg-[#2b2a36] px-1 text-[11px] leading-[14px] text-[#f7f2e8]"
            style={{
              left: `${(spot.x / AUTOMATION_W) * 100}%`,
              top: `${((spot.y + 27) / height) * 100}%`,
            }}
          >
            {index + 1}
          </span>
        )
      })}
    </div>
  )
}
