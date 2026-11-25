import { lang, t } from "@/i18n"
import { useEffect, useRef, useState, type RefObject } from "react"

import { TOOL_BUTTON, ToggleMark } from "@/kttn/kttn-capture"
import { cn } from "@/lib/utils"
import { FPS, toVideo, videoType } from "@/kttn/timelapse-video"
import {
  addFrame,
  clearFrames,
  framesOf,
  isQuota,
  localDay,
  type Frame,
} from "@/kttn/timelapse-store"

// 하루 타임랩스. 자동 기록을 켜 두면 화면이 보이는 동안 10분마다 건물 바닥을
// 작은 그림으로 찍어 이 브라우저에 남기고(timelapse-store.ts), 창에서 그날
// 장면을 빠르게 넘겨 보거나 영상(WebM)으로 저장한다. 기본은 꺼짐이다.

const STORE = "kttn.timelapse"
const EVERY_MS = 10 * 60_000
const WIDTH = 960

const saved = () => {
  try {
    return localStorage.getItem(STORE) === "on"
  } catch {
    return false
  }
}

/** 건물 바닥 전체를 폭 WIDTH 안팎의 JPEG로 찍는다. */
async function shoot(floor: HTMLElement) {
  const { domToBlob } = await import("modern-screenshot")
  const width = floor.scrollWidth
  return domToBlob(floor, {
    width,
    height: floor.scrollHeight,
    scale: Math.min(1, WIDTH / Math.max(1, width)),
    type: "image/jpeg",
    quality: 0.7,
    style: { overflow: "visible" },
  })
}

/** 안내 줄의 타임랩스 버튼과 창 */
export function KttnTimelapse({
  area,
}: {
  area: RefObject<HTMLElement | null>
}) {
  const [on, setOn] = useState(saved)
  const [open, setOpen] = useState(false)
  const [frames, setFrames] = useState<Frame[]>([])
  const [index, setIndex] = useState(0)
  const [note, setNote] = useState("")
  const urls = useRef<string[]>([])

  // 켜져 있으면 바로 한 장, 그 뒤 10분마다 찍는다(화면이 보일 때만).
  useEffect(() => {
    if (!on) return
    const take = () => {
      const floor = area.current?.querySelector<HTMLElement>("[data-floor]")
      if (!floor || document.hidden) return
      void shoot(floor)
        .then((blob) => addFrame(blob))
        .then(() => setNote(""))
        .catch((error) =>
          // 저장 공간이 모자라면 창에 알린다(그 밖의 실패는 다음 차례에 다시).
          setNote(isQuota(error) ? t("timelapse.full") : "")
        )
    }
    take()
    const timer = window.setInterval(take, EVERY_MS)
    return () => window.clearInterval(timer)
  }, [on, area])

  // 창을 열면 오늘 장면을 읽어 와 차례로 넘긴다.
  useEffect(() => {
    if (!open) return
    let live = true
    void framesOf(localDay(Date.now()))
      .then((list) => live && setFrames(list))
      .catch(() => live && setFrames([]))
    return () => {
      live = false
    }
  }, [open])
  useEffect(() => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current = frames.map((frame) => URL.createObjectURL(frame.blob))
    setIndex(0)
    return () => {
      for (const url of urls.current) URL.revokeObjectURL(url)
      urls.current = []
    }
  }, [frames])
  useEffect(() => {
    if (!open || frames.length < 2) return
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % frames.length),
      1000 / FPS
    )
    return () => window.clearInterval(timer)
  }, [open, frames.length])

  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      localStorage.setItem(STORE, next ? "on" : "off")
    } catch {
      // 저장소를 못 쓰면 이 탭에서만 켠다.
    }
  }

  const format = videoType()
  const save = async () => {
    if (!frames.length || !format) return
    setNote("")
    try {
      const video = await toVideo(frames, format.mime)
      const link = document.createElement("a")
      link.href = URL.createObjectURL(video)
      link.download = `kttn-timelapse-${localDay(Date.now())}.${format.ext}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
    } catch {
      setNote(t("timelapse.failed"))
    }
  }

  // 기록 삭제는 두 번 눌러야 한다(5초 안에)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 5000)
    return () => window.clearTimeout(timer)
  }, [armed])
  const clear = async () => {
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    await clearFrames().catch(() => {})
    setFrames([])
  }

  // Esc로 창을 닫는다.
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [open])

  const frame = frames[index]
  return (
    <>
      <button
        type="button"
        className={TOOL_BUTTON}
        aria-pressed={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ToggleMark on={open} />
        {t("timelapse.button")}
      </button>
      {open ? (
        <section
          role="dialog"
          aria-label={t("timelapse.title")}
          className="fixed top-1/2 left-1/2 z-[80] grid w-[min(90vw,640px)] -translate-x-1/2 -translate-y-1/2 gap-1 border-4 border-[#2b2a36] bg-[#2b2a36] p-1 text-[#f7f2e8] shadow-[6px_6px_0_#2b2a36]"
        >
          <header className="flex items-center gap-2 px-1 text-xs">
            <h3>{t("timelapse.title")}</h3>
            <span className="opacity-80">
              {frame
                ? t("timelapse.frame", {
                    time: new Date(frame.at).toLocaleTimeString(lang(), {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    n: index + 1,
                    total: frames.length,
                  })
                : ""}
            </span>
          </header>
          {urls.current[index] ? (
            <img
              src={urls.current[index]}
              alt=""
              className="w-full bg-[#f4efe6] [image-rendering:pixelated]"
            />
          ) : (
            <p className="bg-[#f4efe6] p-4 text-xs text-[#2b2a36]">
              {on ? t("timelapse.waiting") : t("timelapse.empty")}
            </p>
          )}
          {/* 무엇이 어디에 남는지 */}
          <p className="px-1 text-[10px] leading-snug opacity-80">
            {t("timelapse.privacy")} {t("timelapse.saveHint")}
          </p>
          <div className="flex items-center justify-end gap-1">
            {note ? (
              <span role="status" className="mr-auto text-[10px]">
                {note}
              </span>
            ) : null}
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-pressed={on}
              onClick={toggle}
            >
              <ToggleMark on={on} />
              {t("timelapse.auto")}
            </button>
            {format ? (
              <button
                type="button"
                className={TOOL_BUTTON}
                disabled={!frames.length}
                onClick={() => void save()}
              >
                {t("timelapse.save")}
              </button>
            ) : null}
            <button
              type="button"
              className={cn(TOOL_BUTTON, armed && "bg-[#c0392b]")}
              disabled={!frames.length}
              onClick={() => void clear()}
            >
              {armed ? t("timelapse.clearConfirm") : t("timelapse.clear")}
            </button>
            <span role="status" className="sr-only">
              {armed ? t("timelapse.clearHint") : ""}
            </span>
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t("timelapse.close")}
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
