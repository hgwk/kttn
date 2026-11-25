// 책상 구역의 배치 계산(자리 좌표, 구역 크기, 문). 그림과 걷는 길이 함께 쓴다.
// 그리기와 화면 요소를 모르는 순수 계산이라 시험에서 바로 불러 쓴다.

export const MAX_DESKS = 12
// 아홉 자리까지는 한 줄에 셋, 그보다 많으면 넷씩 앉혀 방이 너무 길어지지 않게 한다.
const DESK_COLS = 3
const WIDE_DESK_COLS = 4
// 자리 사이를 넓혀 고양이 머리 위 대사 상자가 이웃과 겹치지 않게 한다.
export const DESK_GAP_X = 92
export const DESK_GAP_Y = 94
const DESK_TOP = 44
const MIN_OFFICE_W = 96
// 고양이는 책상 오른쪽 절반에 앉고 왼쪽 절반에 모니터가 놓인다.
export const CAT_DX = 7
/** 앉은 고양이 발밑에서 머리 위까지(대사 상자 꼬리가 닿는 곳) */
export const CAT_HEAD = 14
/** 의자에 앉은 고양이 발밑이 책상 자리보다 아래인 만큼 */
export const SIT_OFFSET = 5

export type OfficeLayout = {
  cols: number
  rows: number
  w: number
  h: number
  offsetX: number
  door: { x: number; y: number }
}

/**
 * 책상 배치. 최대 열두 자리다. fitCols가 있으면 방 너비에 들어가는 만큼 열을
 * 늘리거나 줄여 넓은 화면에서는 낮고 넓게, 좁은 화면에서는 높고 좁게 앉힌다.
 */
export function officeLayout(count: number, fitCols?: number): OfficeLayout {
  const desks = Math.max(1, Math.min(count, MAX_DESKS))
  const cols = Math.min(
    desks,
    fitCols ?? (desks > 9 ? WIDE_DESK_COLS : DESK_COLS)
  )
  const rows = Math.ceil(desks / cols)
  // 오른쪽 끝 자리의 대사 상자가 구역 밖으로 나가지 않게 오른쪽을 조금 더 둔다.
  const natural = 86 + (cols - 1) * DESK_GAP_X
  const w = Math.max(MIN_OFFICE_W, natural)
  const h = DESK_TOP + (rows - 1) * DESK_GAP_Y + 52
  return {
    cols,
    rows,
    w,
    h,
    offsetX: Math.floor((w - natural) / 2),
    // 고양이가 드나드는 문(왼쪽 위, 복도 쪽). 그림 밖에서 출발하면 경계에 몸이
    // 잘려 보이므로 그림 안쪽 첫 줄(몸 높이 16)에 둔다.
    door: { x: 10, y: 16 },
  }
}

// 자리 좌표. 책상 왼쪽 끝에서 15px 들어온 곳이고, 고양이는 책상 뒤에 앉는다.
export function seatFor(layout: OfficeLayout, index: number) {
  const col = index % layout.cols
  const row = Math.floor(index / layout.cols)
  return {
    x: layout.offsetX + 36 + col * DESK_GAP_X,
    y: DESK_TOP + row * DESK_GAP_Y,
  }
}

/** 자리에 앉은 고양이의 발밑 */
export const seatPoint = (layout: OfficeLayout, index: number) => {
  const seat = seatFor(layout, index)
  return { x: seat.x + CAT_DX, y: seat.y + SIT_OFFSET }
}
