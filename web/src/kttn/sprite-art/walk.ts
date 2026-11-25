import { HEAD } from "./cat-pose.ts"
import type { Grid } from "./palette"

// 걷는 다리. 0·2는 두 발을 딛고 1·3은 한 발씩 든다. 한 발을 들면 딛은
// 다리가 한 칸 길어져 몸이 한 칸 올라간다(walkFrame이 위 빈 줄을 덜어 낸다).
const STEP = (left: boolean, right: boolean): Grid => {
  const top = `...k${left ? "k" : "f"}kkkkkk${right ? "k" : "f"}k...`
  const foot = `...${left ? "..." : "kkk"}....${right ? "..." : "kkk"}...`
  if (!left && !right) return [top, foot]
  const leg = `...${left ? "..." : "kfk"}....${right ? "..." : "kfk"}...`
  return [top, leg, foot]
}

// 아래를 맞춰 16줄로 자른다. 몸이 올라간 칸은 맨 위 빈 줄이 빠진다.
const walkFrame = (...parts: Grid[]): Grid => parts.flat().slice(-16)

const WALK_BODY: Grid = [
  "...kjwwttwwjk...",
  "..kjjjwttwjjjk..",
  "..kfjjjttjjjfk..",
]

const GAIT: [boolean, boolean][] = [
  [false, false],
  [true, false],
  [false, false],
  [false, true],
]

/** 정면 걷기 네 칸. */
export const CAT_FRONT_WALK: Grid[] = GAIT.map(([l, r]) =>
  walkFrame(HEAD, WALK_BODY, STEP(l, r)),
)

// 뒷면. 뒤통수와 셔츠 깃, 정장 등판, 몸 오른쪽으로 세운 꼬리.
const BACK_HEAD: Grid = [
  "................",
  "...k........k...",
  "..kssk....kssk..",
  "..kfsskkkkssfk..",
  "..kffffffffffk..",
  "..kffffffffffk..",
  ".ksffffffffffsk.",
  ".ksffffffffffsk.",
  ".kssffffffffssk.",
  "..kssssssssssk..",
  "...kkkkkkkkkk.k.",
]

const BACK_BODY: Grid = [
  "...kjjwwwwjjkkfk",
  "..kjjjjJJjjjjkfk",
  "..kfjjjJJjjjfkfk",
]

/** 뒷면 걷기 네 칸. */
export const CAT_BACK_WALK: Grid[] = GAIT.map(([l, r]) =>
  walkFrame(
    BACK_HEAD,
    BACK_BODY,
    STEP(l, r).map((row, i) => (i === 0 ? `${row.slice(0, 13)}kk.` : row)),
  ),
)

// 옆모습(오른쪽을 본다). 정면만큼 큰 머리와 통통한 몸, 짧은 다리, 뒤로 선
// 꼬리. 왼쪽으로 갈 때는 뒤집어 그린다.
export const SIDE_UPPER: Grid = [
  "................",
  "......k...k.....",
  ".....knk.knk....",
  "....kfffkfffkkk.",
  "....kffffffffffk",
  "...kffffffffeffk",
  "...kffffffffeffk",
  "...kffffffffeffk",
  "...kfffffffcfffn",
  ".k..kssffffffsk.",
  "kfk.kjjwtwjjk...",
  "kfk.kjjjtjjjjk..",
  ".kfkjjjjjjjjfk..",
  "..kkkkkkkkkkkk..",
]

// 꼬리를 한 칸 내린 윗몸. 발을 바꿔 딛는 칸에 써서 걸을 때 꼬리가 흔들린다.
const SIDE_UPPER_SWAY: Grid = [
  ...SIDE_UPPER.slice(0, 9),
  "....kssffffffsk.",
  ".k..kjjwtwjjk...",
  "kfk.kjjjtjjjjk..",
  "kfkkjjjjjjjjfk..",
  SIDE_UPPER[13],
]

const SIDE_LEGS: Grid[] = [
  ["....kfk..kfk....", "....kkk..kkk...."],
  [".....kfkkfk.....", ".....kfkkfk.....", ".....kkkkkk....."],
  ["...kfk....kfk...", "...kkk....kkk..."],
  [".....kfkkfk.....", ".....kfkkfk.....", ".....kkkkkk....."],
]

/** 옆 걷기 네 칸. */
export const CAT_SIDE_WALK: Grid[] = SIDE_LEGS.map((legs, i) =>
  walkFrame(i % 2 ? SIDE_UPPER_SWAY : SIDE_UPPER, legs),
)

// 장난감과 놀기(옆모습, 오른쪽을 본다). 0은 몸을 한 칸 낮춰 웅크리고 꼬리를
// 흔들고, 1은 뒷발로 서서 앞발 하나를 얼굴 앞으로 휘두른다.
const CROUCH: Grid = [
  "................",
  "................",
  ...SIDE_UPPER_SWAY.slice(1, 13),
  "..kffkkkkkffkk..",
  "..kkkk...kkkk...",
]
const SWIPE: Grid = [
  ...SIDE_UPPER.slice(0, 9),
  ".k..kssffffffkkk",
  "kfk.kjjwtwjjkffk",
  "kfk.kjjjtjjjkffk",
  ".kfkjjjjjjjjkkk.",
  "..kkkkkkkkkkkk..",
  "....kfk.........",
  "....kkk.........",
]

/** 옆모습 놀기 두 칸: 웅크리기, 앞발 휘두르기. */
export const CAT_SIDE_PLAY: Grid[] = [CROUCH, SWIPE]
