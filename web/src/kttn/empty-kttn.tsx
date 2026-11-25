import { t } from "@/i18n"
import {
  PIXEL_SCALE,
  drawChair,
  drawDesk,
  drawRoom,
  deskLayout,
} from "@/kttn/kttn-draw"
import { RoomFrame } from "@/kttn/room-frame"
import { usePixelLoop } from "@/kttn/use-pixel-loop"

const EMPTY_DESKS = 3

/** 아무도 출근하지 않은 kttn. 빈 책상과 의자만 놓인 방과 안내를 보인다. */
export function EmptyKttn() {
  const layout = deskLayout(EMPTY_DESKS)
  const canvasRef = usePixelLoop(EMPTY_DESKS, (ctx, count, _dt, t) => {
    const room = deskLayout(count)
    drawRoom(ctx, room)
    for (let i = 0; i < count; i++) {
      drawChair(ctx, room, i)
      drawDesk(ctx, room, i, null, t)
    }
  })

  return (
    <section aria-labelledby="kttn-empty" className="h-full min-h-0">
      <h2 id="kttn-empty" className="sr-only">
        {t("empty.title")}
      </h2>
      {/* 다른 kttn 화면처럼 TV 틀이 남는 화면을 채운다. */}
      <div className="flex h-full min-h-0 max-w-full">
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
              // 좁은 창에서는 틀 폭에 맞춰 줄어든다(원래 크기보다 커지지는 않는다).
              style={{ width: "100%", maxWidth: layout.w * PIXEL_SCALE }}
              className="block h-auto [image-rendering:pixelated]"
            />
            <p className="max-w-sm bg-[#fffdf7]/90 px-2 py-1.5 text-sm text-[#2b2a36]">
              {t("empty.body")}
            </p>
          </div>
        </RoomFrame>
      </div>
    </section>
  )
}
