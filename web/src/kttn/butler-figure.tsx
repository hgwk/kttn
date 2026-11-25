import type { RefObject } from "react"

import { t } from "@/i18n"
import { SIZE } from "@/kttn/butler-controls"

/** 집사 그림 한 칸: 걸음 그림 캔버스, 머리 위 말 상자, 발밑 이름표. */
export function ButlerFigure({
  boxRef,
  canvasRef,
  sayRef,
}: {
  boxRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  sayRef: RefObject<HTMLSpanElement | null>
}) {
  return (
  <div
    ref={boxRef}
    data-butler=""
    aria-hidden="true"
    className="pointer-events-none absolute top-0 left-0 z-30"
    style={{ width: SIZE, height: SIZE }}
  >
    <canvas
      ref={canvasRef}
      width={16}
      height={16}
      className="block size-full [image-rendering:pixelated]"
    />
    <span
      ref={sayRef}
      hidden
      className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 border-2 border-[#2b2a36] bg-[#fffdf7] px-1 text-[11px] leading-[14px] whitespace-nowrap text-[#2b2a36]"
    />
    <span className="absolute top-full left-1/2 -translate-x-1/2 bg-[#c0392b] px-1 text-[11px] leading-[14px] whitespace-nowrap text-white">
      {t("butler.name")}
    </span>
  </div>
  )
}
