import type { Grid } from "./palette"

// 정면 머리. 몸보다 큰 머리, 짧고 뾰족한 세모 귀, 세로로 긴 눈, 볼과 작은 코.
export const HEAD: Grid = [
  "................",
  "...k........k...",
  "..knfk....kfnk..",
  "..kfffkkkkfffk..",
  "..kffffffffffk..",
  "..kffeffffeffk..",
  ".kfffeffffefffk.",
  ".kfffeffffefffk.",
  ".ksfcffnnffcfsk.",
  "..kssffffffssk..",
  "...kkkkkkkkkk...",
]

// 눈 세 줄(5~7행)과 입(9행)만 바꾼 얼굴.
const face = (eyes: Grid, mouth = HEAD[9]): Grid => [
  ...HEAD.slice(0, 5),
  ...eyes,
  HEAD[8],
  mouth,
  HEAD[10],
]
// 감은 눈: 눈 아래쪽에 가로줄.
export const BLINK = face([
  "..kffffffffffk..",
  ".kffffffffffffk.",
  ".kffkkkffkkkffk.",
])
// 잠든 눈: 아래로 둥근 반달.
export const SLEEP = face([
  "..kffffffffffk..",
  ".kffkfkffkfkffk.",
  ".kfffkffffkfffk.",
])
// 놀란 얼굴: 눈을 한 칸 더 크게 뜨고 입을 벌린다.
// 오류로 멈춘 얼굴: X자 눈에 입을 꾹 다문다. 졸린 얼굴과 헷갈리지 않게 한다.
const DIZZY = face(
  ["..kfefeffefefk..", ".kfffeffffefffk.", ".kffefeffefeffk."],
  "..kssfkkkkfssk..",
)
export const SURPRISED = face(HEAD.slice(5, 8), "..kffffkkffffk..").map(
  (row, y) => (y === 4 ? "..kffeffffeffk.." : row),
)

export const BODY: Grid = [
  "...kjwwttwwjk...",
  "..kjjjwttwjjjk..",
  "..kfjjjttjjjfk..",
  "..kjjjjjjjjjjk..",
  "...kkkkkkkkkk...",
]

// 털 고르기: 눈을 감고 왼 앞발을 턱까지 들어 핥는다. 혀를 내민 칸과 넣은 칸을 번갈아 보인다.
const grooming = (lick: boolean): Grid => [
  ...BLINK.slice(0, 8),
  ".kssssknnffcfsk.",
  lick ? "..kfffknnffssk.." : "..kfffkffffssk..",
  "..kfffkkkkkkk...",
  "..kfjwwttwwjk...",
  "..kfjjwttwjjjk..",
  "..kjjjjttjjjfk..",
  ...BODY.slice(3),
]

// 자판 치기: 앞발을 한쪽씩 번갈아 든다.
const typing = (left: boolean): Grid => [
  BODY[0],
  left ? "..kfjjwttwjjjk.." : "..kjjjwttwjjfk..",
  left ? "..kjjjjttjjjfk.." : "..kfjjjttjjjjk..",
  ...BODY.slice(3),
]

// 머리를 한 칸 내린다. 깃 줄이 턱 밑에 가려진다.
const bob = (head: Grid): Grid => [
  "................",
  ...head,
  ...BODY.slice(1),
]

// 엎드려 졸기: 머리를 두 칸 더 숙여 책상 위에 포갠 앞발에 턱을 괸다.
const NAP: Grid = [
  "................",
  "................",
  ...SLEEP.slice(0, 9),
  "..kssffffffssk..",
  "kffkkkkkkkkkkffk",
  "kfffkjjwwjjkfffk",
  "kkkkkjjjjjjkkkkk",
  "...kkkkkkkkkk...",
]

/** 앉은 자세 일곱 칸: 대기, 눈 깜빡임, 들썩임, 졸기, 놀람, 자판 치기 두 칸. */
export const CAT_POSE: Grid[] = [
  [...HEAD, ...BODY],
  [...BLINK, ...BODY],
  bob(HEAD),
  NAP,
  [...SURPRISED, ...BODY],
  [...HEAD, ...typing(true)],
  [...HEAD, ...typing(false)],
  bob(DIZZY),
  grooming(true),
  grooming(false),
]

export const POSE_FRAME = {
  sit: 0,
  blink: 1,
  bob: 2,
  sleep: 3,
  alert: 4,
  typeLeft: 5,
  typeRight: 6,
  dizzy: 7,
  groomLick: 8,
  groomRest: 9,
} as const
