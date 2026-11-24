import type { Frame } from "@/office/timelapse-store"

// 타임랩스 장면들을 영상으로 만든다(office-timelapse.tsx의 저장).

/** 영상의 초당 장면 수 */
export const FPS = 6

// 이 브라우저가 만들 수 있는 영상 형식. Safari는 WebM 대신 MP4다. 둘 다
// 못 만들면 저장 버튼을 숨긴다.
export function videoType() {
  if (typeof MediaRecorder === "undefined") return null
  for (const [mime, ext] of [
    ["video/webm", "webm"],
    ["video/mp4", "mp4"],
  ] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  return null
}

/**
 * 장면들을 캔버스에 차례로 그려 영상으로 만든다. 하루치(최대 160장)를 한꺼번에
 * 풀면 메모리를 수백 MB 쓰므로 한 장씩 풀어 그리고 바로 버린다. 프레임은
 * 그릴 때마다 직접 넘긴다(captureStream(0)과 requestFrame).
 */
export async function toVideo(frames: Frame[], mime: string) {
  const first = await createImageBitmap(frames[0].blob)
  const canvas = document.createElement("canvas")
  canvas.width = first.width
  canvas.height = first.height
  first.close()
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void
  }
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const stopped = new Promise((resolve) => (recorder.onstop = resolve))
  recorder.start()
  for (const frame of frames) {
    const image = await createImageBitmap(frame.blob)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.close()
    track.requestFrame?.()
    await new Promise((resolve) => setTimeout(resolve, 1000 / FPS))
  }
  recorder.stop()
  await stopped
  return new Blob(chunks, { type: mime })
}
