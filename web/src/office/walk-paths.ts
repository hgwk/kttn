// 책상 구역 고양이가 걷는 길. 출입문↔자리, 자리↔다른 자리(찾아가 얘기하기),
// 산책, 캣타워·소품 나들이, 배치가 바뀐 뒤 새 자리로, 통로에서 문으로. 어디서
// 출발하든 책상을 가로지르지 않게 샛길과 줄 아래 통로만 걷는다.
import {
  CAT_DX,
  DESK_GAP_X,
  seatFor,
  type OfficeLayout,
} from "@/office/office-draw"

export type Point = { x: number; y: number }

/** 의자에 앉은 고양이 발밑이 책상 자리보다 아래인 만큼 */
export const SIT_OFFSET = 5

export const seatPoint = (layout: OfficeLayout, index: number) => {
  const seat = seatFor(layout, index)
  return { x: seat.x + CAT_DX, y: seat.y + SIT_OFFSET }
}

// 책상 오른쪽 옆 샛길. 책상 오른쪽 끝(자리 x+15)과 이웃 책상 왼쪽 끝
// (x+간격-15) 사이 한가운데라 고양이(폭 16)가 어느 책상에도 걸치지 않는다.
export const AISLE_DX = DESK_GAP_X / 2
// 줄 아래 통로. 이름표(자리 y+21~30) 아래, 다음 줄 말풍선 위를 지난다.
export const LANE_DY = 44

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

// 퇴근길은 같은 길을 거꾸로 걸어 문밖으로 나간다.
export function pathToDoor(layout: OfficeLayout, index: number) {
  const desk = seatFor(layout, index)
  const seat = seatPoint(layout, index)
  const lane = desk.y + LANE_DY
  const aisle = desk.x + AISLE_DX
  return [
    { x: aisle, y: seat.y },
    { x: aisle, y: lane },
    { x: layout.door.x, y: lane },
    layout.door,
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

// 자리(앉은 발밑)에서 그 책상 옆 샛길과 줄 아래 통로까지의 거리
const TO_AISLE = AISLE_DX - CAT_DX
const TO_LANE = LANE_DY - SIT_OFFSET

/**
 * 배치가 바뀌어(세션이 늘거나 줄거나 창 폭이 바뀌어) 자리를 옮기는 고양이의 길.
 * 옛 자리 옆 샛길로 내려가 줄 아래 통로를 지나 새 자리 옆 샛길로 올라간다.
 */
export function pathToNewSeat(
  from: Point,
  layout: OfficeLayout,
  index: number
): Point[] {
  const seat = seatPoint(layout, index)
  const oldAisle = from.x + TO_AISLE
  const oldLane = from.y + TO_LANE
  const aisle = seat.x + TO_AISLE
  return [
    { x: oldAisle, y: from.y },
    { x: oldAisle, y: oldLane },
    { x: aisle, y: oldLane },
    { x: aisle, y: seat.y },
    seat,
  ]
}

/** 통로 위 한 점(lane)에서 그 통로를 따라 문까지 걸어 나가는 길 */
export const pathOut = (lane: Point, layout: OfficeLayout): Point[] => [
  lane,
  { x: layout.door.x, y: lane.y },
  layout.door,
]
