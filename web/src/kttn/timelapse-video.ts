import type { Frame } from "@/kttn/timelapse-store"

// 타임랩스 장면들을 영상으로 만든다(kttn-timelapse.tsx의 저장).

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
 * 풀면 메모리를 수백 MB 쓰므로 한 장씩 풀어 그리고 바로 버린다. 영상의 장면
 * 시각은 프레임이 도착한 때라, 저장하는 동안 탭이 가려지면 장면이 길어진다
 * (창에 "탭을 열어 두기" 안내).
 */
export async function toVideo(frames: Frame[], mime: string) {
  const first = await createImageBitmap(frames[0].blob)
  const canvas = document.createElement("canvas")
  canvas.width = first.width
  canvas.height = first.height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    first.close()
    throw new Error("no canvas")
  }
  // 첫 장면을 먼저 그려 둔다(시간으로 담는 대체 경로가 시작하자마자 빈 화면을
  // 담지 않게).
  ctx.drawImage(first, 0, 0)
  first.close()
  // 프레임을 직접 넘길 수 있으면(requestFrame) 그렇게 하고, 못 하는
  // 브라우저에서는 초당 FPS로 저절로 담는다(그대로 두면 빈 영상이 된다).
  let stream = canvas.captureStream(0)
  let track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void
  }
  if (typeof track.requestFrame !== "function") {
    for (const old of stream.getTracks()) old.stop()
    stream = canvas.captureStream(FPS)
    track = stream.getVideoTracks()[0]
  }
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const stopped = new Promise((resolve) => (recorder.onstop = resolve))
  recorder.start()
  try {
    for (const frame of frames) {
      const image = await createImageBitmap(frame.blob)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.close()
      track.requestFrame?.()
      await new Promise((resolve) => setTimeout(resolve, 1000 / FPS))
    }
  } finally {
    // 중간에 장면을 못 풀어도 녹화와 스트림은 꼭 멈춘다.
    if (recorder.state === "recording") recorder.stop()
    for (const used of stream.getTracks()) used.stop()
  }
  await stopped
  return new Blob(chunks, { type: mime })
}
