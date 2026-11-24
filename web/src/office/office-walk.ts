// 사무실 고양이의 걸음. 출입문↔자리, 자리↔다른 자리(찾아가 얘기하기) 길을
// 책상을 피해 만들고, 그 길을 따라 한 프레임씩 옮긴다. 그림은 office-canvas.tsx가 그린다.
import {
  CAT_DX,
  DESK_GAP_X,
  seatFor,
  type OfficeLayout,
} from "@/office/office-draw"
import type { CatDir } from "@/office/sprites"
import { holdTrip } from "@/office/visit-sync"

export const WALK_SPEED = 0.05 // 논리 픽셀/ms
const SIT_OFFSET = 5

export type Point = { x: number; y: number }
// 다른 고양이에게 가서 얘기하는 중. go(가는 중) → stay(얘기) → back(돌아오는 중).
export type Visit = {
  stage: "go" | "stay" | "back"
  /** 찾아간 고양이 key */
  to: string
  /** stay가 끝나는 시각(그림 시계 t) */
  until: number
  /** until을 미리 정해 둔 긴 머묾(캣타워). 도착해도 until을 다시 정하지 않는다. */
  long?: boolean
  back: Point[]
}
export type Walker = Point & {
  path: Point[]
  dir: CatDir
  visit?: Visit
  /** 이미 걸어가 본 메시지 시각. 같은 메시지는 한 번만 찾아간다. */
  played?: string
  /** 이미 산책을 다녀온 쉬는 시간 칸(IDLE_SLOT_MS 단위). 칸마다 한 번만 간다. */
  strolled?: number
  /** 퇴근길을 걷는 중 */
  leaving?: boolean
  /** 퇴근길 끝에서 문밖으로 나갔다 */
  out?: boolean
}

// 찾아가서 얘기하는 시간(ms)
export const VISIT_STAY_MS = 3_000

export const seatPoint = (layout: OfficeLayout, index: number) => {
  const seat = seatFor(layout, index)
  return { x: seat.x + CAT_DX, y: seat.y + SIT_OFFSET }
}

// 책상 오른쪽 옆 샛길. 책상 오른쪽 끝(자리 x+15)과 이웃 책상 왼쪽 끝
// (x+간격-15) 사이 한가운데라 고양이(폭 16)가 어느 책상에도 걸치지 않는다.
const AISLE_DX = DESK_GAP_X / 2
// 줄 아래 통로. 이름표(자리 y+21~30) 아래, 다음 줄 말풍선 위를 지난다.
const LANE_DY = 44

// 출입문에서 자리까지 책상을 피해 가는 길: 왼쪽 벽 통로 → 줄 아래 통로 →
// 책상 옆 샛길로 올라가 → 책상 뒤로 돌아 의자에 앉는다.
export function pathToSeat(layout: OfficeLayout, index: number) {
  const desk = seatFor(layout, index)
  const seat = seatPoint(layout, index)
  const lane = desk.y + LANE_DY
  const aisle = desk.x + AISLE_DX
  return [
    { x: layout.door.x, y: lane },
    { x: aisle, y: lane },
    { x: aisle, y: seat.y },
    seat,
  ]
}

/** 출입문이 난 벽. 건물 바깥 방은 아래, 복도에 면한 칸막이 방은 위다. */
export type DoorSide = "top" | "bottom"

// 고양이가 나타나고 사라지는 문 자리. 그림(캔버스) 밖에서 출발하면 경계에
// 걸려 몸이 잘려 보이므로, 위쪽 문은 그림 안쪽 첫 줄(몸 높이 16)에 둔다.
export const outsideY = (layout: OfficeLayout, door: DoorSide) =>
  door === "top" ? 16 : layout.h + 16

// 퇴근길은 같은 길을 거꾸로 걸어 문밖으로 나간다.
export function pathToDoor(
  layout: OfficeLayout,
  index: number,
  door: DoorSide
) {
  const desk = seatFor(layout, index)
  const seat = seatPoint(layout, index)
  const lane = desk.y + LANE_DY
  const aisle = desk.x + AISLE_DX
  return [
    { x: aisle, y: seat.y },
    { x: aisle, y: lane },
    { x: layout.door.x, y: lane },
    { x: layout.door.x, y: outsideY(layout, door) },
  ]
}

// 내 자리에서 다른 자리 오른쪽 샛길까지 가는 길과 돌아오는 길. 내 책상 옆
// 샛길로 내려가 줄 아래 통로를 지나 그 책상 옆 샛길로 올라가 선다.
export function pathsToVisit(layout: OfficeLayout, from: number, to: number) {
  const mine = seatFor(layout, from)
  const theirs = seatFor(layout, to)
  const seat = seatPoint(layout, from)
  const lane = mine.y + LANE_DY
  const myAisle = mine.x + AISLE_DX
  const theirAisle = theirs.x + AISLE_DX
  const stand = { x: theirAisle, y: seatPoint(layout, to).y }
  return {
    go: [
      { x: myAisle, y: seat.y },
      { x: myAisle, y: lane },
      { x: theirAisle, y: lane },
      stand,
    ],
    back: [
      { x: theirAisle, y: lane },
      { x: myAisle, y: lane },
      { x: myAisle, y: seat.y },
      seat,
    ],
  }
}

// 쉬는 고양이의 산책길. 책상 옆 샛길로 내려가 줄 아래 통로를 따라 책상
// 왼쪽까지 걸었다가 같은 길로 돌아와 앉는다.
export function pathsToStroll(layout: OfficeLayout, index: number) {
  const desk = seatFor(layout, index)
  const seat = seatPoint(layout, index)
  const lane = desk.y + LANE_DY
  const aisle = desk.x + AISLE_DX
  return {
    go: [
      { x: aisle, y: seat.y },
      { x: aisle, y: lane },
      { x: desk.x - 20, y: lane },
    ],
    back: [{ x: aisle, y: lane }, { x: aisle, y: seat.y }, seat],
  }
}

// 캣타워로 가는 길. 책상 옆 샛길로 내려가 줄 아래 통로를 지나 책상 구역
// 아래(휴게 공간 쪽)로 걸어 나간다. 돌아올 때는 같은 길을 거꾸로 걷는다.
export function pathsToTower(layout: OfficeLayout, index: number) {
  const desk = seatFor(layout, index)
  const seat = seatPoint(layout, index)
  const lane = desk.y + LANE_DY
  const aisle = desk.x + AISLE_DX
  return {
    go: [
      { x: aisle, y: seat.y },
      { x: aisle, y: lane },
      // 책상 구역 아래 끝에서 휴게 공간으로 사라진다(awayOnVisit). 그림판
      // 밖으로 걸어 나가면 아래에 놓인 다른 방 밑을 지나가는 것처럼 보인다.
      { x: aisle, y: layout.h - 2 },
    ],
    back: [{ x: aisle, y: lane }, { x: aisle, y: seat.y }, seat],
  }
}

// 얘기하는 고양이 옆의 작은 말풍선(점 셋이 차례로 깜빡인다).
export function drawTalk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number
) {
  // 머리 위는 찾아간 고양이의 대사 상자가 덮으므로 머리 오른쪽 옆에 띄운다.
  const left = Math.round(x + 7)
  const top = Math.round(y - 19)
  ctx.fillStyle = "#2b2a36"
  ctx.fillRect(left, top, 13, 7)
  // 꼬리는 왼쪽 아래(고양이 입 쪽)로 낸다.
  ctx.fillRect(left, top + 7, 2, 2)
  ctx.fillStyle = "#fffdf7"
  ctx.fillRect(left + 1, top + 1, 11, 5)
  const lit = Math.floor(t / 250) % 3
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === lit ? "#2b2a36" : "#9ca3af"
    ctx.fillRect(left + 3 + i * 3, top + 3, 1, 1)
  }
}

export function step(walker: Walker, dt: number) {
  let budget = dt * WALK_SPEED
  while (budget > 0 && walker.path.length > 0) {
    const target = walker.path[0]
    const dx = target.x - walker.x
    const dy = target.y - walker.y
    const distance = Math.hypot(dx, dy)
    if (distance > 0)
      walker.dir =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "front"
            : "back"
    if (distance <= budget) {
      walker.x = target.x
      walker.y = target.y
      walker.path.shift()
      budget -= distance
    } else {
      walker.x += (dx / distance) * budget
      walker.y += (dy / distance) * budget
      budget = 0
    }
  }
}

/**
 * 쉬는 고양이가 산책(stroll)이나 캣타워(tower)·소품(prop) 차례면 길을 정해 준다. 같은
 * 칸(slot, slotMs 단위)에는 한 번만 간다. 캣타워에는 그 칸이 끝날 때까지 있다.
 */
export function startIdleWalk(
  walker: Walker,
  activity: string,
  slot: number,
  layout: OfficeLayout,
  index: number,
  slotMs = 60_000,
  strollStartMs = 3_000,
  now = Date.now()
) {
  if (activity !== "stroll" && activity !== "tower" && activity !== "prop")
    return
  if (walker.strolled === slot) return
  // 산책은 1분 첫머리에만 나선다(늦게 나서면 대사가 졸기로 먼저 바뀐다).
  if (activity === "stroll" && now - slot * slotMs > strollStartMs) return
  walker.strolled = slot
  // 캣타워와 소품은 휴게 공간으로 걸어 나가 그 칸이 끝날 때까지 있다.
  const tower = activity === "tower" || activity === "prop"
  const paths = tower
    ? pathsToTower(layout, index)
    : pathsToStroll(layout, index)
  walker.path = paths.go
  walker.visit = {
    stage: "go",
    to: "",
    until: tower ? (slot + 1) * slotMs : 0,
    back: paths.back,
    long: tower,
  }
}

/**
 * 찾아가기·산책 단계를 넘긴다. 도착하면 머물고(stay), 시간이 되면 돌아오고
 * (back), 자리에 앉으면 끝낸다. 찾아간 고양이가 방에 없으면 바로 돌아온다.
 */
export function advanceVisit(
  walker: Walker,
  t: number,
  present: (key: string) => boolean,
  /** 이 고양이. 캣타워나 소품에 가 있다가 일을 받아 깨면 걸어서 돌아온다. */
  agent?: { key: string; state: string }
) {
  const visit = walker.visit
  if (!visit) return
  const rest = agent?.state === "sleeping"
  if (visit.long && agent && holdTrip(agent.key, visit, t, rest)) {
    visit.stage = "back"
    walker.path = visit.back
    return
  }
  if (visit.stage === "go" && walker.path.length === 0) {
    visit.stage = "stay"
    if (!visit.long) visit.until = t + VISIT_STAY_MS
    walker.dir = "left"
  } else if (visit.stage === "stay" && t >= visit.until) {
    visit.stage = "back"
    walker.path = visit.back
  } else if (visit.stage === "back" && walker.path.length === 0) {
    walker.visit = undefined
    return
  }
  if (visit.to && visit.stage !== "back" && !present(visit.to)) {
    visit.stage = "back"
    walker.path = visit.back
  }
}

/** 같은 방의 다른 자리(to)로 찾아가 얘기하러 출발한다. */
export function startVisit(
  walker: Walker,
  layout: OfficeLayout,
  from: number,
  to: number,
  toKey: string
) {
  const paths = pathsToVisit(layout, from, to)
  walker.path = paths.go
  walker.visit = { stage: "go", to: toKey, until: 0, back: paths.back }
}

/** 캣타워나 소품에 가 있는 동안. 책상 구역에는 그리지 않는다(휴게 공간에 그린다). */
export const awayOnVisit = (walker: Walker) =>
  Boolean(walker.visit?.long && walker.visit.stage === "stay")

/** 그림에 안 보이는 고양이(문밖, 휴게 공간)는 대사를 자리 위에 둔다. */
export const offDesk = (w: Walker, room: OfficeLayout) =>
  awayOnVisit(w) || w.x < 0 || w.x > room.w || w.y < 14 || w.y > room.h
