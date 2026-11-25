// kttn 스프라이트를 그린다. 그림 정본은 sprite-data.ts의 글자 격자이고,
// 여기서는 고양이마다 털·눈·넥타이 색을 넣은 팔레트로 칠해 캔버스에 찍는다.
// 바닥·벽 타일은 같은 격자를 SVG 데이터 URI로 바꿔 CSS 배경으로 쓴다.
import {
  BASE_PALETTE,
  CAT_BACK_WALK,
  CAT_FRONT_WALK,
  CAT_POSE,
  CAT_SIDE_PLAY,
  CAT_SIDE_WALK,
  KITTEN,
  KITTEN_WAIT,
  POSE_FRAME,
  SMOKE,
  type Grid,
  type ItemName,
} from "@/kttn/sprite-data"

export type { ItemName } from "@/kttn/sprite-data"
export { drawGrid, drawItem, TILE, type Floor } from "@/kttn/item-draw"

// 털 주색·그늘색. dark인 털은 눈을 노랗게 칠해 얼굴이 묻히지 않게 한다.
type Coat = { f: string; s: string; dark?: boolean }

const EYE = "#2b2a36"
const DARK_EYE = "#f5cf4f"

/** 열두 가지 털색. */
export const COATS: Coat[] = [
  { f: "#f6f2ea", s: "#dcd5c8" }, // 눈송이
  { f: "#f2dcb0", s: "#d9bf8c" }, // 크림
  { f: "#f0a35a", s: "#d4823a" }, // 귤
  { f: "#b4875a", s: "#946a42" }, // 보리
  { f: "#8a6248", s: "#6f4d37", dark: true }, // 코코아
  { f: "#a9abb4", s: "#8b8e98" }, // 회색
  { f: "#a3b4cc", s: "#8597b1" }, // 은청
  { f: "#5e606d", s: "#4c4e5a", dark: true }, // 숯
  { f: "#45434f", s: "#38363f", dark: true }, // 까망
  { f: "#f3bba3", s: "#dc9c82" }, // 복숭아
  { f: "#c7b8da", s: "#ab9bc2" }, // 라일락
  { f: "#e8c66f", s: "#cba650" }, // 호박
]

export function coatFor(key: string) {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % COATS.length
}

function paint(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  palette: Record<string, string>,
  ox: number,
  oy: number
) {
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = row[x] === "." ? undefined : palette[row[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  })
}

export function sheetCanvas(frames: Grid[], palette: Record<string, string>) {
  const canvas = document.createElement("canvas")
  const w = frames[0]?.[0]?.length ?? 16
  canvas.width = w * frames.length
  canvas.height = frames[0]?.length ?? 16
  const ctx = canvas.getContext("2d")
  if (ctx) frames.forEach((grid, i) => paint(ctx, grid, palette, i * w, 0))
  return canvas
}

/** 고양이 하나의 팔레트(털·그늘·눈·넥타이를 칠한 기본 팔레트) */
export function catPalette(coatIndex: number, tie: string) {
  const coat = COATS[coatIndex]
  return {
    ...BASE_PALETTE,
    f: coat.f,
    s: coat.s,
    e: coat.dark ? DARK_EYE : EYE,
    t: tie,
  }
}

const CAT_SHEETS = {
  pose: CAT_POSE,
  "front-walk": CAT_FRONT_WALK,
  "back-walk": CAT_BACK_WALK,
  "side-walk": CAT_SIDE_WALK,
  // 장난감 곁에서 노는 옆모습(웅크림, 앞발 휘두르기)
  "side-play": CAT_SIDE_PLAY,
  // 하위 에이전트용 새끼 고양이(10×10). 앞발을 번갈아 드는 두 칸이다.
  kitten: KITTEN,
  // 사람을 기다리는 새끼 고양이(한 칸)
  "kitten-wait": [KITTEN_WAIT],
}

type SheetName = keyof typeof CAT_SHEETS

const catCache = new Map<string, HTMLCanvasElement>()

function catSheet(coatIndex: number, tie: string, sheet: SheetName) {
  const key = `${coatIndex}|${tie}|${sheet}`
  let canvas = catCache.get(key)
  if (!canvas) {
    canvas = sheetCanvas(CAT_SHEETS[sheet], catPalette(coatIndex, tie))
    catCache.set(key, canvas)
  }
  return canvas
}

export type CatPose =
  | "sit"
  | "type"
  | "sleep"
  | "alert"
  | "dizzy"
  | "groom"
  | "gaze"
  | "walk"
  | "eat"
  | "hum"
  | "play"
  | "curl"
export type CatDir = "front" | "back" | "left" | "right"

// 앉은 자세의 프레임. 대기는 가끔 눈을 깜빡이고, 일할 때는 앞발을 번갈아
// 들며 자판을 친다.
function poseFrame(pose: CatPose, t: number) {
  if (pose === "sleep") return POSE_FRAME.sleep
  if (pose === "alert") return POSE_FRAME.alert
  // 오류로 멈춘 고양이. 머리를 숙이고 X자 눈을 한다.
  if (pose === "dizzy") return POSE_FRAME.dizzy
  // 털 고르기. 앞발을 핥았다 쉬었다 한다.
  if (pose === "groom")
    return Math.floor(t / 300) % 2 ? POSE_FRAME.groomRest : POSE_FRAME.groomLick
  if (pose === "type")
    return Math.floor(t / 220) % 2 ? POSE_FRAME.typeLeft : POSE_FRAME.typeRight
  // 밥그릇·물 분수 앞. 고개를 깊이 숙이고 씹을 때 한 칸 더 숙인다.
  if (pose === "eat")
    return Math.floor(t / 400) % 2 ? POSE_FRAME.eatChew : POSE_FRAME.eatLook
  // 레코드플레이어·피아노 앞. 웃는 눈으로 고개를 좌우로 기울이며 흥얼거린다.
  if (pose === "hum")
    return Math.floor(t / 500) % 2 ? POSE_FRAME.humRight : POSE_FRAME.humLeft
  // 침대·해먹·캣타워 층에서 몸을 둥글게 말고 잔다. 가끔 귀를 움찔한다.
  if (pose === "curl")
    return Math.floor(t / 300) % 8 === 0 ? POSE_FRAME.curlTwitch : POSE_FRAME.curl
  return [POSE_FRAME.sit, POSE_FRAME.sit, POSE_FRAME.blink, POSE_FRAME.sit][
    Math.floor(t / 500) % 4
  ]
}

/** 고양이 한 마리. (x, y)는 발밑 가운데다. */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  coatIndex: number,
  tie: string,
  pose: CatPose,
  dir: CatDir,
  t: number,
  size = 16
) {
  const walking = pose === "walk"
  const playing = pose === "play"
  const sheet: SheetName = walking
    ? dir === "left" || dir === "right"
      ? "side-walk"
      : dir === "back"
        ? "back-walk"
        : "front-walk"
    : playing
      ? "side-play"
      : pose === "gaze"
        ? "back-walk"
        : "pose"
  const src = catSheet(coatIndex, tie, sheet)
  // 창밖 구경(gaze)은 뒤돌아 선 칸(뒷모습 걸음의 첫 칸)에 멈춰 있다. 놀 때는
  // 웅크렸다 앞발을 휘둘렀다 한다.
  const frame = walking
    ? Math.floor(t / 120) % 4
    : playing
      ? Math.floor(t / 350) % 2
      : pose === "gaze"
        ? 0
        : poseFrame(pose, t)
  ctx.imageSmoothingEnabled = false
  const dx = Math.round(x - size / 2)
  const dy = Math.round(y - size)
  // 옆모습은 오른쪽을 본다. 왼쪽으로 걷거나 놀 때는 뒤집어 그린다.
  if ((walking || playing) && dir === "left") {
    ctx.save()
    ctx.translate(dx + size, dy)
    ctx.scale(-1, 1)
    ctx.drawImage(src, frame * 16, 0, 16, 16, 0, 0, size, size)
    ctx.restore()
  } else {
    ctx.drawImage(src, frame * 16, 0, 16, 16, dx, dy, size, size)
  }
}

/** 새끼 고양이 한 마리. (x, y)는 발밑 가운데다. 원래 크기(10px)로 그린다. */
export function drawKitten(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  coatIndex: number,
  tie: string,
  t: number,
  /** 그 하위 에이전트가 사람을 기다리는 중(고개를 들고 멈춘다) */
  waiting = false
) {
  const src = catSheet(coatIndex, tie, waiting ? "kitten-wait" : "kitten")
  const size = KITTEN[0].length
  const frame = waiting ? 0 : Math.floor(t / 220) % KITTEN.length
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    src,
    frame * size,
    0,
    size,
    size,
    Math.round(x - size / 2),
    Math.round(y - size),
    size,
    size
  )
}

let smokeSheet: HTMLCanvasElement | null = null

/**
 * 연기 한 줄기(7×14, 네 칸). (x, y)는 연기가 나오는 맨 아랫줄의 왼쪽이다.
 * 칸을 140ms마다 돌려 아래 김이 커지며 위로 빠져나간다.
 */
export function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number
) {
  smokeSheet ??= sheetCanvas(SMOKE, BASE_PALETTE)
  const w = SMOKE[0][0].length
  const h = SMOKE[0].length
  const frame = Math.floor(t / 140) % SMOKE.length
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    smokeSheet,
    frame * w,
    0,
    w,
    h,
    Math.round(x),
    Math.round(y - h + 1),
    w,
    h
  )
}
