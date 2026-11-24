import { t } from "@/i18n"
import { PixelIcon } from "@/office/pixel-icon"
import {
  OFFICE_SCALE,
  drawChair,
  drawDesk,
  drawRoom,
  officeLayout,
} from "@/office/office-draw"
import { GameWindow } from "@/office/game-ui"
import { RoomFrame } from "@/office/room-frame"
import { usePixelLoop } from "@/office/use-pixel-loop"

const EMPTY_DESKS = 3

/** 아무도 출근하지 않은 사무실. 빈 책상과 의자만 놓인 방과 안내를 보인다. */
export function EmptyOffice() {
  const layout = officeLayout(EMPTY_DESKS)
  const canvasRef = usePixelLoop(EMPTY_DESKS, (ctx, count, _dt, t) => {
    const room = officeLayout(count)
    drawRoom(ctx, room)
    for (let i = 0; i < count; i++) {
      drawChair(ctx, room, i)
      drawDesk(ctx, room, i, null, t)
    }
  })

  return (
    <GameWindow
      labelledBy="office-empty"
      title={
        <span className="inline-flex items-center gap-1.5">
          <PixelIcon name="house" />
          {t("empty.title")}
        </span>
      }
    >
      <div className="flex max-w-full">
        <RoomFrame
          label={t("empty.room")}
          ariaLabel={t("empty.roomLabel")}
          kind="building"
        >
          <div className="grid gap-3">
            <canvas
              ref={canvasRef}
              width={layout.w}
              height={layout.h}
              role="img"
              aria-label={t("empty.drawing")}
              style={{ width: layout.w * OFFICE_SCALE }}
              className="block h-auto max-w-full [image-rendering:pixelated]"
            />
            <p className="max-w-sm bg-[#fffdf7]/90 px-2 py-1.5 text-sm text-[#2b2a36]">
              {t("empty.body")}
            </p>
          </div>
        </RoomFrame>
      </div>
    </GameWindow>
  )
}
