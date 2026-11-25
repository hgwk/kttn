import { BODY, HEAD, SLEEP, SURPRISED } from "./cat-pose.ts"
import type { Grid } from "./palette.ts"

export { BODY, HEAD, SLEEP, SURPRISED }

// 자유 자리 그림의 공용 조각과 조립 함수(seats.ts가 쓴다). 자리 하나는 가구·기기·고양이를 한 격자에 겹쳐 그린
// 장면 여섯 칸이다. 고양이 칸은 f·s·e·t(털·그늘·눈·넥타이)를 고양이마다
// 칠하고, 기기 화면·불빛 칸 "!"은 상태 색(ledColor)으로 칠한다. 나머지는
// BASE_PALETTE다. 얼굴·몸통은 앉은 고양이(cat-pose.ts)와 같은 조각을 쓴다.

export type SeatFrame = "work0" | "work1" | "idle" | "alert" | "rest" | "empty"
export type SeatArt = {
  /** 바닥에 닿는 아래 가운데. 책상 자리의 발밑과 같은 곳에 놓는다. */
  anchor: { x: number; y: number }
  /** 대사 상자 꼬리를 대는 머리 꼭대기 가운데(idle 칸 기준). */
  head: { x: number; y: number }
  frames: Record<SeatFrame, Grid>
}

export type Layer = readonly [Grid, number, number]

// 빈 격자 위에 조각을 차례로 겹친다. "."은 아래 칸을 그대로 둔다.
export function scene(w: number, h: number, ...layers: Layer[]): Grid {
  const rows = Array.from({ length: h }, () => Array<string>(w).fill("."))
  for (const [grid, ox, oy] of layers)
    grid.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (cell !== "." && rows[oy + y]?.[ox + x] !== undefined)
          rows[oy + y][ox + x] = cell
      }),
    )
  return rows.map((row) => row.join(""))
}

// 테두리 친 타원(방석·빈백). fill 위쪽에 빛, 아래쪽에 그늘을 깐다.
export function blob(
  w: number,
  h: number,
  light: string,
  fill: string,
  shade: string,
): Grid {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const inside = (x: number, y: number) =>
    ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2 <= 1
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (!inside(x, y)) return "."
      const edge = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => !inside(nx, ny))
      if (edge) return "k"
      if (y < h / 3) return light
      return y >= h - 2 - Math.floor(h / 5) ? shade : fill
    }).join(""),
  )
}

// 앉은 고양이 윗몸(16칸 폭, 13줄): 귀부터 턱, 셔츠 깃·넥타이 두 줄과 정장.
export const upper = (face: Grid): Grid => [
  ...face.slice(1),
  ...BODY.slice(0, 3),
]
// 접은 다리. 방석·창턱에 앉은 고양이 아래에 둔다.
export const KNEES: Grid = [".kffffkkkkffffk.", ".kkkkk....kkkkk."]
// 자판을 치는 앞발. 든 발은 덮개 위로 세 줄, 내린 발은 덮개 윗선에 걸친다.
export const PAW_UP: Grid = [".kk.", "kffk", "kffk"]
export const PAW_REST: Grid = ["kffk"]

// 노트북 뒷면(12×5). 고양이 쪽을 보고 있어 덮개 등과 불빛 "!"만 보인다.
export const LID: Grid = [
  "kkkkkkkkkkkk",
  "kggggggggggk",
  "kgggg!!gggGk",
  "kggggggggggk",
  "kkkkkkkkkkkk",
]
// 덮은 노트북(12×3).
export const CLOSED: Grid = ["kkkkkkkkkkkk", "kGGGGGGGGGGk", "kkkkkkkkkkkk"]

// 장면 한 칸: 고양이 몸(body)은 앞 가구 뒤에, 기기와 앞발(kit)은 맨 앞에 쌓는다.
export type Pose = { body: Layer[]; kit: Layer[] }
export type Poses = Record<Exclude<SeatFrame, "empty">, Pose>

// 무릎에 노트북을 둔 앉은 고양이의 다섯 칸. (cx, top)은 고양이 윗몸 왼쪽 위,
// (lidX, lidY)는 노트북 덮개 왼쪽 위다. 덮개는 넥타이 두 줄(top+10, top+11)
// 아래에 와서 어느 칸에서도 넥타이가 보인다.
export function lapCat(
  cx: number,
  top: number,
  lidX: number,
  lidY: number,
): Poses {
  const sit = (face: Grid): Layer[] => [[upper(face), cx, top]]
  const lid: Layer = [LID, lidX, lidY]
  const left = lidX + 1
  const right = lidX + 7
  return {
    work0: {
      body: sit(HEAD),
      kit: [lid, [PAW_UP, left, lidY - 3], [PAW_REST, right, lidY]],
    },
    work1: {
      body: sit(HEAD),
      kit: [lid, [PAW_REST, left, lidY], [PAW_UP, right, lidY - 3]],
    },
    idle: {
      body: sit(HEAD),
      kit: [lid, [PAW_REST, left, lidY], [PAW_REST, right, lidY]],
    },
    alert: {
      body: sit(SURPRISED),
      kit: [lid, [PAW_UP, left, lidY - 3], [PAW_UP, right, lidY - 3]],
    },
    // 쉴 때는 고개를 한 칸 숙이고 노트북을 덮어 무릎에 내려놓는다.
    rest: {
      body: [
        [upper(SLEEP), cx, top + 1],
        [BODY.slice(3), cx, top + 14],
      ],
      kit: [[CLOSED, lidX, lidY + 2]],
    },
  }
}

export function seat(
  w: number,
  h: number,
  anchor: SeatArt["anchor"],
  head: SeatArt["head"],
  behind: Layer[],
  poses: Poses,
  front: Layer[],
  empty: Layer[],
): SeatArt {
  const draw = ({ body, kit }: Pose) =>
    scene(w, h, ...behind, ...body, ...front, ...kit)
  return {
    anchor,
    head,
    frames: {
      work0: draw(poses.work0),
      work1: draw(poses.work1),
      idle: draw(poses.idle),
      alert: draw(poses.alert),
      rest: draw(poses.rest),
      empty: scene(w, h, ...behind, ...front, ...empty),
    },
  }
}
