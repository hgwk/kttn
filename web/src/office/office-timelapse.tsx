import { lang, t } from "@/i18n"
import { useEffect, useRef, useState, type RefObject } from "react"

import { TOOL_BUTTON, ToggleMark } from "@/office/office-capture"
import {
  addFrame,
  framesOf,
  localDay,
  type Frame,
} from "@/office/timelapse-store"

// 하루 타임랩스. 자동 기록을 켜 두면 화면이 보이는 동안 10분마다 건물 바닥을
// 작은 그림으로 찍어 이 브라우저에 남기고(timelapse-store.ts), 창에서 그날
// 장면을 빠르게 넘겨 보거나 영상(WebM)으로 저장한다. 기본은 꺼짐이다.

const STORE = "kttn.timelapse"
const EVERY_MS = 10 * 60_000
const FPS = 6
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

/** 장면들을 캔버스에 차례로 그려 WebM으로 만든다. */
async function toVideo(frames: Frame[]) {
  const images = await Promise.all(frames.map((f) => createImageBitmap(f.blob)))
  const canvas = document.createElement("canvas")
  canvas.width = images[0].width
  canvas.height = images[0].height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  const stream = canvas.captureStream(FPS)
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const stopped = new Promise((resolve) => (recorder.onstop = resolve))
  recorder.start()
  for (const image of images) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    await new Promise((resolve) => setTimeout(resolve, 1000 / FPS))
  }
  recorder.stop()
  await stopped
  return new Blob(chunks, { type: "video/webm" })
}

/** 안내 줄의 타임랩스 버튼과 창 */
export function OfficeTimelapse({
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
        .catch(() => {})
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

  const save = async () => {
    if (!frames.length) return
    setNote("")
    try {
      const video = await toVideo(frames)
      const link = document.createElement("a")
      link.href = URL.createObjectURL(video)
      link.download = `kttn-timelapse-${localDay(Date.now())}.webm`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
    } catch {
      setNote(t("timelapse.failed"))
    }
  }

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
          <div className="flex items-center justify-end gap-1">
            {note ? <span role="status" className="mr-auto text-[10px]">{note}</span> : null}
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-pressed={on}
              onClick={toggle}
            >
              <ToggleMark on={on} />
              {t("timelapse.auto")}
            </button>
            <button
              type="button"
              className={TOOL_BUTTON}
              disabled={!frames.length}
              onClick={() => void save()}
            >
              {t("timelapse.save")}
            </button>
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
