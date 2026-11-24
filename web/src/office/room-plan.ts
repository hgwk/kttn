// 칸막이 방 배치 계산. 방마다 책상 수와 안쪽 방들의 크기로 몇 가지 배치를
// 만들어 보고, 쓸 수 있는 폭 안에서 키가 가장 낮은 것을 고른다.
//   - 책상은 셋까지 한 줄로, 그보다 많으면 정사각형에 가깝게 놓되 두 줄까지만
//     쌓는다(1×1, 2×1, 3×1, 2×2, 3×2, 4×2 …).
//   - 안쪽 방이 있으면 문패 아래 복도를 깔고, 그 아래에 이 방의 책상 구역과
//     안쪽 방들을 칸처럼 선반에 늘어놓는다. 큰 방부터 놓고, 한 줄 폭을 바꿔
//     가며 쓸 수 있는 폭 안에서 키가 가장 낮은 것을 고른다.
// 결과는 방마다 화면 폭(px)과 안쪽 방 순서다. 실제 줄바꿈은 브라우저가 같은
// 폭으로 하므로 계산과 화면이 맞는다. 숫자는 room-frame.tsx의 틀과 같다.
import { officeLayout } from "@/office/office-draw"
import { OFFICE_SCALE } from "@/office/pixel"

/** 책상을 정사각형에 가깝게 놓을 때의 열 수 */
export const squareCols = (count: number) =>
  Math.max(1, Math.ceil(Math.sqrt(count)))

// room-frame.tsx의 칸막이 방 틀(테두리 2 + 칸막이 4 + 안쪽 테두리 2)
const FRAME = 16
// 문패 줄(pt-1.5 + 이름표 한 줄)
const PLATE_H = 24
// 문패가 들어갈 최소 안쪽 폭(문 자리 48 + 이름표)
const MIN_INNER_W = 150
// 책상 구역 안쪽 여백(p-2) 양쪽
const DESK_PAD = 16
// 복도 높이, 칸 줄 여백: 왼쪽 세로 복도 44 + 오른쪽 8, 아래 12
const CORRIDOR_H = 32
const WING_X = 52
const WING_BOTTOM = 12
// 방 사이 간격(gap-3)
const GAP = 12

export type PlanNode = { id: string; desks: number; children: PlanNode[] }

export type RoomPlan = {
  /** 방 바깥 폭(px) */
  width: number
  /** 안쪽 방 순서(id) */
  order: string[]
  /** 책상 열 수 */
  deskCols: number
}

type Size = { w: number; h: number }

function deskBlock(desks: number, cols: number): Size {
  if (!desks) return { w: 0, h: 0 }
  const layout = officeLayout(desks, cols)
  return {
    w: layout.w * OFFICE_SCALE + DESK_PAD,
    h: layout.h * OFFICE_SCALE + DESK_PAD,
  }
}

// 책상은 두 줄까지만 쌓는다. 화면은 오른쪽부터 채우므로(키 낮게) 고양이가
// 많으면 정사각형보다 옆으로 늘어선다.
const MAX_DESK_ROWS = 2

// 책상 열 수. 정사각형에 가깝게 놓되 두 줄을 넘지 않는다. 방이 쓸 수 있는
// 폭을 넘으면 열을 줄여 세로로 더 쌓는다.
function deskCols(desks: number, maxW: number) {
  // 셋까지는 한 줄로 앉힌다(2×2로 두면 한 자리가 비고 방이 높아진다).
  let cols =
    desks <= 3
      ? desks
      : Math.max(squareCols(desks), Math.ceil(desks / MAX_DESK_ROWS))
  while (cols > 1 && FRAME + deskBlock(desks, cols).w > maxW) cols -= 1
  return cols
}

// 선반 쌓기. 주어진 폭에 차례로 놓고, 넘치면 다음 줄로 간다(flex-wrap과 같다).
function shelve(items: Size[], width: number) {
  let rowW = 0
  let rowH = 0
  let total = 0
  let used = 0
  let rows = 0
  for (const item of items) {
    if (rowW > 0 && rowW + GAP + item.w > width) {
      total += rowH
      used = Math.max(used, rowW)
      rows += 1
      rowW = 0
      rowH = 0
    }
    rowW += (rowW > 0 ? GAP : 0) + item.w
    rowH = Math.max(rowH, item.h)
  }
  if (rowW > 0) {
    total += rowH
    used = Math.max(used, rowW)
    rows += 1
  }
  return { w: used, h: total + GAP * Math.max(0, rows - 1) }
}

// 화면은 세로로 스크롤되므로 쓸 수 있는 폭 안에서 키가 가장 낮은 배치를
// 고른다. 키가 같으면 좁은 쪽이 낫다.
const score = ({ w, h }: Size) => h * 100_000 + w

/**
 * 방 하나와 그 안쪽 방들의 배치를 계산해 plans에 적고, 방 크기를 돌려준다.
 * maxW는 이 방이 쓸 수 있는 가장 넓은 폭이다. 넘는 배치는 고르지 않는다.
 */
function planRoom(
  node: PlanNode,
  plans: Map<string, RoomPlan>,
  maxW: number,
  // 이 방이 쓸 수 있는 높이. 유한하면 그 높이 안에서 가장 좁은 배치를 고른다
  // (화면 아래를 비워 두고 옆으로 늘어서지 않게).
  maxH = Number.POSITIVE_INFINITY
): Size {
  // 안쪽 방이 있으면 책상 구역도 복도 아래 칸 줄(왼쪽 통로 안쪽)에 선다.
  const cols = deskCols(node.desks, node.children.length ? maxW - WING_X : maxW)
  const desk = deskBlock(node.desks, cols)

  if (!node.children.length) {
    const size = {
      w: FRAME + Math.max(desk.w, MIN_INNER_W),
      h: FRAME + PLATE_H + desk.h,
    }
    plans.set(node.id, {
      width: size.w,
      order: [],
      deskCols: cols,
    })
    return size
  }

  // 폭을 넘는 배치는 맞는 배치가 하나도 없을 때만, 그중 가장 좁은 것을 쓴다.
  type Pick = { size: Size; order: string[]; inner: Map<string, RoomPlan> }
  let best: Pick | null = null
  // 고르는 차례: 폭 안에 드는가 → 높이 안에 드는가 → (둘 다 들면) 좁은 쪽,
  // (폭만 들면) 낮은 쪽, (폭도 넘으면) 좁은 쪽.
  const rank = (size: Size) => {
    const fitsW = size.w <= maxW
    const fitsH = size.h <= maxH
    if (fitsW && fitsH) return [0, size.w, size.h]
    if (fitsW) return [1, score(size), 0]
    return [2, size.w, size.h]
  }
  const consider = (pick: Pick) => {
    if (!best) {
      best = pick
      return
    }
    const a = rank(pick.size)
    const b = rank(best.size)
    if ((a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) < 0) best = pick
  }

  // 복도 아래 한 줄에 이 방의 책상 구역과 안쪽 방들을 칸처럼 늘어놓는다.
  // 안쪽 방이 쓸 폭은 두 가지로 따로 계산해 본다. 줄 폭을 다 쓰는 경우와,
  // 책상 구역 옆에 들어갈 만큼 좁히는 경우다(책상 옆자리가 비지 않게).
  const full = maxW - FRAME - WING_X
  const budgets = new Set(desk.w ? [full, full - desk.w - GAP] : [full])
  // 높이가 정해져 있으면 안쪽 방을 좁고 높게 놓는 경우도 본다(넓은 방을
  // 여러 줄로 접어 화면 높이를 채우고 옆으로 덜 늘어서게).
  if (Number.isFinite(maxH)) {
    const widest = Math.max(
      ...node.children.map((child) => planRoom(child, new Map(), full).w)
    )
    for (const share of [0.75, 0.5, 0.35]) {
      budgets.add(Math.round(widest * share))
    }
  }
  for (const budget of budgets) {
    const inner = new Map<string, RoomPlan>()
    const kids = node.children
      .map((child) => ({ id: child.id, ...planRoom(child, inner, budget) }))
      // 큰 방부터 놓아야 줄마다 높이가 고르다.
      .sort((a, b) => b.h - a.h || b.w - a.w)
    const order = kids.map((kid) => kid.id)
    const items = desk.w ? [desk, ...kids] : kids

    // 한 줄 폭 후보: 첫 k개가 한 줄에 서는 폭(k = 1..n)
    const widest = Math.max(...items.map((item) => item.w))
    const shelves = new Set<number>([widest])
    let run = 0
    items.forEach((item, index) => {
      run += (index ? GAP : 0) + item.w
      shelves.add(Math.max(run, widest))
    })
    for (const shelf of shelves) {
      const rows = shelve(items, shelf)
      consider({
        size: {
          w: FRAME + Math.max(WING_X + rows.w, MIN_INNER_W),
          h: FRAME + PLATE_H + CORRIDOR_H + rows.h + WING_BOTTOM,
        },
        order,
        inner,
      })
    }
  }

  const chosen = best as unknown as Pick
  for (const [id, plan] of chosen.inner) plans.set(id, plan)
  plans.set(node.id, {
    width: chosen.size.w,
    order: chosen.order,
    deskCols: cols,
  })
  return chosen.size
}

/**
 * 사무실(맨 바깥 칸막이 방)들의 배치를 한꺼번에 계산한다. floorW는 건물 벽
 * 안쪽 바닥 폭이다. 무한이면 폭 제한 없이 놓는다. floorH(사무실이 쓸 수 있는
 * 높이)를 주면 그 높이 안에서 가장 좁게, 없으면 키가 가장 낮게(오른쪽부터) 놓는다.
 */
export function planRooms(roots: PlanNode[], floorW: number, floorH = 0) {
  const plans = new Map<string, RoomPlan>()
  // 건물 틀(벽 두께)과 칸 줄 여백을 뺀 폭이 맨 바깥 방들이 쓸 수 있는 폭이다.
  const maxW = floorW > 0 ? floorW - FRAME - WING_X : Number.POSITIVE_INFINITY
  // 높이를 주면(화면 높이) 사무실마다 그 안에서 가장 좁게 놓는다.
  const maxH = floorH > 0 ? floorH : Number.POSITIVE_INFINITY
  for (const root of roots) planRoom(root, plans, maxW, maxH)
  return plans
}
