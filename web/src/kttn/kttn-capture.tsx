import { t } from "@/i18n"
import { useEffect, useRef, useState, type RefObject } from "react"
import { cn } from "@/lib/utils"

// kttn 건물 바닥([data-floor])만 이미지로 저장하거나 화면 녹화한다.
// 크롬 개발자 도구의 "Capture node screenshot"처럼 그 요소만 담는 게 목표다.

// 파일 이름에 붙이는 이 컴퓨터 시각(kttn-20261123-0930).
function stamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function download(href: string, name: string) {
  const link = document.createElement("a")
  link.href = href
  link.download = name
  link.click()
}

// 요소 단위 녹화 API. 크롬 일부 버전에만 있어 타입 정의가 없다.
type TargetFactory = { fromElement(element: Element): Promise<unknown> }
type RestrictableTrack = MediaStreamTrack & {
  restrictTo?: (target: unknown) => Promise<void>
  cropTo?: (target: unknown) => Promise<void>
}

// 녹화할 트랙을 바닥 요소로 좁힌다. 영역 자르기(Region Capture)를 먼저 쓴다.
// 요소만 담기(Element Capture, restrictTo)는 대상이 따로 쌓임 맥락을 만들지
// 않으면 성공한 척하고 프레임을 내지 않아, 자르기가 없을 때만 쓴다. 둘 다
// 안 되면 탭 전체를 담는다.
async function narrowTo(track: RestrictableTrack, floor: Element) {
  const scope = globalThis as unknown as {
    RestrictionTarget?: TargetFactory
    CropTarget?: TargetFactory
  }
  try {
    if (scope.CropTarget && track.cropTo) {
      await track.cropTo(await scope.CropTarget.fromElement(floor))
      return true
    }
    if (scope.RestrictionTarget && track.restrictTo) {
      await track.restrictTo(await scope.RestrictionTarget.fromElement(floor))
      return true
    }
  } catch {
    // 이 탭이 아닌 화면을 골랐으면 좁힐 수 없다. 고른 화면 그대로 담는다.
  }
  return false
}

function recorderType() {
  for (const type of [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}

/**
 * 화면 아래 안내 줄의 작은 버튼 모양(캡처, 녹화, 전체화면, 도감 등). 켜고 끄는
 * 버튼(aria-pressed)은 색만으로 알지 못하는 사람도 알 수 있게 글자 앞에
 * ToggleMark를 단다.
 */
export const TOOL_BUTTON =
  "bg-[#2b2a36]/85 px-1.5 py-0.5 text-[10px] text-[#f7f2e8] hover:bg-[#2b2a36] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 aria-pressed:bg-[#c0392b]"

/**
 * 켜고 끄는 버튼 글자 앞의 ●(켜짐)/○(꺼짐). 화면 낭독기는 aria-pressed로 상태를
 * 읽으므로 이 모양은 읽지 않게 숨긴다(CSS content로 달면 이름에 섞여 두 번 읽힌다).
 */
export function ToggleMark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="mr-1">
      {on ? "●" : "○"}
    </span>
  )
}

/** 화면 아래 안내 줄의 캡처·녹화 버튼. area 안의 건물 바닥을 찾아 담는다. */
export function KttnCapture({
  area,
}: {
  area: RefObject<HTMLElement | null>
}) {
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [note, setNote] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)

  // 화면을 떠나면 녹화와 화면 공유를 멈춘다.
  useEffect(() => () => recorderRef.current?.stop(), [])

  const floor = () =>
    area.current?.querySelector<HTMLElement>("[data-floor]") ?? null

  const capture = async () => {
    const target = floor()
    if (!target || busy) return
    setBusy(true)
    setNote("")
    try {
      const { domToPng } = await import("modern-screenshot")
      // 스크롤에 가려진 방까지 한 장에 담는다.
      const url = await domToPng(target, {
        width: target.scrollWidth,
        height: target.scrollHeight,
        scale: window.devicePixelRatio || 1,
        style: { overflow: "visible", imageRendering: "pixelated" },
      })
      download(url, `kttn-${stamp()}.png`)
    } catch {
      setNote(t("capture.failed"))
    } finally {
      setBusy(false)
    }
  }

  const record = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    const target = floor()
    if (!target) return
    setNote("")
    const dpr = window.devicePixelRatio || 1
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          // 기본값은 탭을 줄여 담아 픽셀이 뭉개진다. 창 크기 그대로 받는다.
          width: { ideal: Math.round(window.innerWidth * dpr) },
          height: { ideal: Math.round(window.innerHeight * dpr) },
          frameRate: { ideal: 30 },
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions)
    } catch {
      // 공유 창에서 취소했다.
      return
    }
    const [track] = stream.getVideoTracks() as RestrictableTrack[]
    const narrowed = await narrowTo(track, target)
    if (!narrowed) setNote(t("capture.wholeTab"))

    const type = recorderType()
    const recorder = new MediaRecorder(
      stream,
      type ? { mimeType: type } : undefined
    )
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onstop = () => {
      for (const each of stream.getTracks()) each.stop()
      recorderRef.current = null
      setRecording(false)
      if (!chunks.length) {
        // 조용히 끝내면 녹화가 된 줄 안다.
        setNote(t("capture.nothing"))
        return
      }
      const url = URL.createObjectURL(
        new Blob(chunks, { type: type || "video/webm" })
      )
      download(url, `kttn-${stamp()}.webm`)
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
    // 크롬 공유 바의 "공유 중지"로 끝내도 저장한다.
    track.addEventListener("ended", () => {
      if (recorder.state !== "inactive") recorder.stop()
    })
    recorderRef.current = recorder
    recorder.start(1000)
    setRecording(true)
  }

  return (
    <>
      <button
        type="button"
        className={TOOL_BUTTON}
        onClick={capture}
        disabled={busy}
        title={t("capture.pngTitle")}
      >
        {busy ? t("capture.capturing") : t("capture.capture")}
      </button>
      <button
        type="button"
        // 녹화하는 동안 빨갛게 깜빡여 녹화 중임을 알린다.
        className={cn(
          TOOL_BUTTON,
          recording && "animate-pulse motion-reduce:animate-none"
        )}
        onClick={record}
        aria-pressed={recording}
        title={t("capture.recordTitle")}
      >
        <ToggleMark on={recording} />
        {t("capture.record")}
      </button>
      {note ? (
        <span role="status" className="text-[10px] text-foreground">
          {note}
        </span>
      ) : null}
    </>
  )
}
