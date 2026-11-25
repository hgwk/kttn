import { SIDE_UPPER } from "./walk.ts"
import type { Grid } from "./palette.ts"
import {
  CLOSED,
  HEAD,
  KNEES,
  LID,
  PAW_REST,
  PAW_UP,
  SLEEP,
  SURPRISED,
  blob,
  lapCat,
  seat,
  upper,
} from "./seat-parts.ts"
import type { Layer, Poses, SeatArt } from "./seat-parts.ts"

// 책상 밖 자유 자리 여섯. 가구·기기·고양이를 한 격자에 겹친 장면 여섯 칸
// (work0·work1·idle·alert·rest·empty)이고, 조각과 조립은 seat-parts.ts에 있다.

// 방석(24×20). 청록 방석에 다리를 접고 앉아 무릎 위 노트북.
const CUSHION = blob(22, 6, "8", "8", "9")
const cushion = seat(
  24,
  20,
  { x: 12, y: 19 },
  { x: 12, y: 1 },
  [[CUSHION, 1, 14]],
  lapCat(4, 1, 6, 13),
  [],
  [[LID, 6, 10]],
  [[KNEES, 4, 15]],
)

// 빈백(26×22). 겨자색 빈백에 파묻혀 기댄 채 배 위 노트북.
const BAG = blob(26, 16, "0", "S", "3")
const BAG_LIP: Grid = blob(22, 5, "S", "S", "3")
const beanBag = seat(
  26,
  22,
  { x: 13, y: 21 },
  { x: 13, y: 3 },
  [[BAG, 0, 6]],
  lapCat(5, 3, 7, 15),
  [[BAG_LIP, 2, 17]],
  [[LID, 7, 12]],
)

// 소파(32×24). 청록 소파 가운데에 앉아 무릎 위 노트북.
const SOFA_BACK: Grid = [
  "....kkkkkkkkkkkkkkkkkkkkkkkk....",
  "...k888888888888888888888888k...",
  "...k888888888888888888888888k...",
  "...k888888888888888888888888k...",
  ".kkk999999999999999999999999kkk.",
]
const SOFA_FRONT: Grid = [
  "k888kkkkkkkkkkkkkkkkkkkkkkkk888k",
  "k888k8888888888888888888888k888k",
  "k888k8888888888888888888888k888k",
  "k888k9999999999999999999999k888k",
  "k999kkkkkkkkkkkkkkkkkkkkkkkk999k",
  "k999k9999999999999999999999k999k",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  ".kk..........................kk.",
]
const sofa = seat(
  32,
  24,
  { x: 16, y: 23 },
  { x: 16, y: 3 },
  [[SOFA_BACK, 0, 11]],
  lapCat(8, 3, 10, 15),
  [[SOFA_FRONT, 0, 16]],
  [[LID, 10, 12]],
)

// 낮은 창턱 선반(26×24). 책과 화분을 꽂은 자작나무 선반 위에 앉았다.
const SHELF: Grid = [
  "kkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kiiiiiiiiiiiiiiiiiiiiiiiik",
  "kkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kAkMMkNNkSSkAAAAkkkkkkkAAk",
  "kAkMMkNNkSSkAAAAkFHFHkkAAk",
  "kAkMMkNNkSSkAAAAkkCCkkkAAk",
  "kAkMMkNNkSSkAAAAkkCCkkkAAk",
  "kbbbbbbbbbbbbbbbbbbbbbbbbk",
  "kkkkkkkkkkkkkkkkkkkkkkkkkk",
]
const sill = seat(
  26,
  24,
  { x: 13, y: 23 },
  { x: 13, y: 0 },
  [],
  lapCat(5, 0, 7, 12),
  [[SHELF, 0, 15]],
  [[LID, 7, 10]],
  [[KNEES, 5, 13]],
)

// 고타쓰(28×20). 체크 이불을 덮은 낮은 상 뒤에 들어앉아 상 위 노트북.
const KOTATSU: Grid = [
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kppppppppppppppppppppppppppk",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kMMwwMMwwMMwwMMwwMMwwMMwwMMk",
  "kMMwwMMwwMMwwMMwwMMwwMMwwMMk",
  "kwwMMwwMMwwMMwwMMwwMMwwMMwwk",
  "kwwMMwwMMwwMMwwMMwwMMwwMMwwk",
  ".kkkkkkkkkkkkkkkkkkkkkkkkkk.",
]
// 고타쓰 고양이는 노트북을 상 위 오른쪽에 두고 옆으로 앞발을 뻗는다.
// 윗몸은 상 위로 넥타이 두 줄까지 보인다.
function kotatsuCat(): Poses {
  const sit = (face: Grid, y = 0): Layer[] => [[upper(face), 2, y]]
  const lid: Layer = [LID, 15, 7]
  return {
    work0: { body: sit(HEAD), kit: [lid, [PAW_UP, 11, 8], [PAW_REST, 15, 11]] },
    work1: { body: sit(HEAD), kit: [lid, [PAW_REST, 11, 11], [PAW_UP, 15, 8]] },
    idle: {
      body: sit(HEAD),
      kit: [lid, [PAW_REST, 11, 11], [PAW_REST, 15, 11]],
    },
    alert: {
      body: sit(SURPRISED),
      kit: [lid, [PAW_UP, 11, 8], [PAW_UP, 4, 8]],
    },
    rest: { body: sit(SLEEP, 1), kit: [[CLOSED, 15, 10]] },
  }
}
const kotatsu = seat(
  28,
  20,
  { x: 14, y: 19 },
  { x: 10, y: 0 },
  [],
  kotatsuCat(),
  [[KOTATSU, 0, 12]],
  [[LID, 15, 7]],
)

// 엎드려 태블릿(30×14). 옆모습(오른쪽을 본다)으로 길게 엎드려, 턱 앞 바닥에
// 화면이 위를 보게 눕힌 태블릿을 앞발로 두드린다. 머리는 걷는 옆모습과 같다.
const SIDE_HEAD: Grid = [...SIDE_UPPER.slice(1, 9), "....kssffffffsk."]
// 옆얼굴 눈(e 세 줄)을 감거나 크게 뜬다.
const sideFace = (eyes: "open" | "shut" | "wide"): Grid =>
  SIDE_HEAD.map((row, y) => {
    if (eyes === "shut")
      return y === 6 ? row.replace("e", "k") : row.replace("e", "f")
    if (eyes === "wide") return y >= 3 && y <= 6 ? row.replace(/fe/, "ee") : row
    return row
  })
// 엎드린 정장 몸통(짧게 해 고양이로 읽히게)과 뒤로 세운 꼬리, 웅크린 뒷발.
const LYING: Grid = [
  "kk..............",
  "kfk.............",
  ".kfk............",
  "..kfk...........",
  "...kfkkkkkkkk...",
  "...kjjjjjjjjjk..",
  "..kjjjjjjjjjjjk.",
  "..kjjjjjjjjjjjk.",
  "..kUUUUUUUUUUUk.",
  "..kffk.kkkkkkk..",
  "..kkkk..........",
]
// 턱 밑 셔츠 깃과 넥타이(두 줄).
const SIDE_COLLAR: Grid = ["kjjwtwjjk.", "kjjjtjjjjk"]
const PAD: Grid = ["kkkkkkkkkk", "k!!!!!!!!k", "kkkkkkkkkk"]
const PAD_OFF: Grid = ["kkkkkkkkkk", "kGGGGGGGGk", "kkkkkkkkkk"]
const SIDE_PAW: Grid = ["kffk", "kkkk"]
const SIDE_PAW_UP: Grid = ["kffk", "kffk", "kkkk"]
function bellyCat(): Poses {
  const body = (eyes: "open" | "shut" | "wide", y = 0): Layer[] => [
    [LYING, 4, 2 + y],
    [sideFace(eyes), 14, y],
    [SIDE_COLLAR, 18, 9 + y],
  ]
  const pad: Layer = [PAD, 19, 11]
  return {
    work0: {
      body: body("open"),
      kit: [pad, [SIDE_PAW_UP, 23, 9], [SIDE_PAW, 26, 10]],
    },
    work1: {
      body: body("open"),
      kit: [pad, [SIDE_PAW, 23, 10], [SIDE_PAW_UP, 26, 9]],
    },
    idle: {
      body: body("open"),
      kit: [pad, [SIDE_PAW, 23, 10], [SIDE_PAW, 26, 10]],
    },
    alert: {
      body: body("wide"),
      kit: [pad, [SIDE_PAW_UP, 23, 9], [SIDE_PAW_UP, 26, 9]],
    },
    // 쉴 때는 눈을 감고 태블릿을 꺼 둔다(몸을 내리면 깃이 태블릿에 가린다).
    rest: {
      body: body("shut"),
      kit: [
        [PAD_OFF, 19, 11],
        [SIDE_PAW, 24, 10],
      ],
    },
  }
}
const MAT = blob(30, 4, "I", "I", "T")
const tabletBelly = seat(
  30,
  14,
  { x: 15, y: 13 },
  { x: 22, y: 0 },
  [[MAT, 0, 10]],
  bellyCat(),
  [],
  [[PAD_OFF, 19, 11]],
)

/** 자유 자리 여섯. 이름은 21의 자리 고르기(kttn-seats.ts)와 맞춘다. */
export const SEATS = {
  cushion,
  tabletBelly,
  beanBag,
  sofa,
  sill,
  kotatsu,
} satisfies Record<string, SeatArt>

export type SeatName = keyof typeof SEATS

export type { SeatArt, SeatFrame } from "./seat-parts.ts"
