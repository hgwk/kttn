import { t } from "@/i18n"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { Butler } from "@/office/butler"
import { typing } from "@/office/butler-controls"

// +/- 로 고르는 배율. 처음은 원래 크기(1)다.
const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5]
// 틀 아래 줄(버튼·현황·안내)을 재기 전의 높이. 재면 실제 높이를 쓴다.
// 페이지 본문(main)의 아래 여백은 따로 잰다.
const HINT_GAP = 28
// 화면이 아주 낮아도 이 높이까지는 쓴다.
const MIN_HEIGHT = 480

/**
 * 게임 화면. 틀은 창 아래 끝까지 고정하고, 그 안을 건물(이 PC) 창이 꽉
 * 채운다. 건물은 TV 같은 카메라 틀(room-frame.tsx의 data-floor) 안에서
 * 벽·이름표째 통째로 스크롤되고, 창 제목·오른쪽 칸은 그대로다. 집사는 그
 * 틀 안을 걷는다. +/- 는 확대·축소, 1은 원래 크기다.
 */
export function OfficeStage({
  scene,
  tools,
  status,
  children,
}: {
  /** 화면에 놓인 건물(바뀌면 집사가 그 건물 정문 안쪽에 선다). */
  scene: string
  /** 아래 안내 줄 왼쪽에 두는 버튼(캡처·녹화·전체화면) */
  tools?: ReactNode
  /** 아래 줄 가운데 현황(시각·작업 중·대기 …) */
  status?: ReactNode
  children: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)

  // 쓸 수 있는 너비와 높이. 높이는 틀 위쪽부터 창(전체화면이면 화면) 아래까지다.
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const measure = () => {
      const top = outer.getBoundingClientRect().top
      const offset = document.fullscreenElement ? top : top + window.scrollY
      const w = outer.clientWidth
      const main = outer.closest("main")
      const pad = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0
      const h = Math.max(
        MIN_HEIGHT,
        window.innerHeight -
          offset -
          (barRef.current?.offsetHeight ?? HINT_GAP) -
          (document.fullscreenElement ? 0 : pad)
      )
      setRoom((old) => (old.w === w && old.h === h ? old : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    if (barRef.current) observer.observe(barRef.current)
    window.addEventListener("resize", measure)
    document.addEventListener("fullscreenchange", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
      document.removeEventListener("fullscreenchange", measure)
    }
  }, [])

  // 배율 키. 한 번에 한 단계씩. 이동 키는 집사(Butler)가 받는다.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typing(event.target)) return
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        setScale((now) => ZOOMS.find((value) => value > now + 0.001) ?? now)
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        setScale((now) => ZOOMS.findLast((value) => value < now - 0.001) ?? now)
      } else if (event.key === "1") {
        event.preventDefault()
        setScale(1)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

  return (
    <div className="relative min-w-0">
      <div
        ref={outerRef}
        className="relative w-full overflow-hidden"
        style={{ height: room.h || undefined }}
      >
        {/* 줄이면 안쪽을 그만큼 넓고 높게 배치한 뒤 줄여 틀에 꼭 맞춘다. */}
        <div
          ref={innerRef}
          className="flex flex-col"
          style={{
            width: room.w ? room.w / scale : "100%",
            height: room.h ? room.h / scale : undefined,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
            // 옆 칸(월드맵)은 이 배율을 되돌려 늘 같은 크기로 둔다(building.tsx).
            ["--office-zoom" as string]: scale,
          }}
        >
          {children}
        </div>
        <Butler stageRef={innerRef} scale={scale} scene={scene} />
      </div>
      {/* 아래 줄: 버튼 · 현황 · 조작 안내. 좁으면 줄을 바꾸고, 틀 높이는 이 줄
          높이만큼 줄인다. */}
      <div ref={barRef} className="flex flex-wrap items-center gap-1 pt-1">
        <div className="flex items-center gap-1">{tools}</div>
        {status}
        <p
          aria-hidden="true"
          className="ml-auto w-fit bg-[#2b2a36]/85 px-1.5 py-0.5 text-[10px] text-[#f7f2e8]"
        >
          {t("stage.help", { scale: Math.round(scale * 100) })}
        </p>
      </div>
    </div>
  )
}
