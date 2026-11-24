// 집사가 걸을 수 있는 곳. 화면의 표시 요소에서 바로 읽는다.
//   [data-floor]    건물을 담은 카메라 틀. 건물이 통째로 이 안에서 스크롤되고,
//                   집사도 이 안에서 걷는다. 값은 건물 이름이다.
//   [data-obstacle] 책상·칸막이처럼 못 지나가는 곳.
//   [data-door]     건물 정문. 집사가 처음 서는 자리를 정한다.
// 좌표는 바닥 안쪽(스크롤 포함, 줄이기 전) 기준이다.

export type Box = { l: number; t: number; r: number; b: number }

export type WalkMap = { floor: Box; door: Box | null; obstacles: Box[] }

// 발 크기. 그림(32px)보다 작게 잡아 책상 앞까지 붙어 설 수 있게 한다.
const FOOT_W = 12
const FOOT_H = 6
// 바닥 위쪽 여백. 집사 머리가 벽 위로 잘리지 않게 이만큼 아래에서 멈춘다.
const HEAD_ROOM = 24

/** 화면 요소를 바닥 안쪽 좌표의 상자로 바꾼다. */
export function boxIn(el: Element, floor: HTMLElement, scale: number): Box {
  const origin = floor.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return {
    l: (r.left - origin.left) / scale + floor.scrollLeft,
    t: (r.top - origin.top) / scale + floor.scrollTop,
    r: (r.right - origin.left) / scale + floor.scrollLeft,
    b: (r.bottom - origin.top) / scale + floor.scrollTop,
  }
}

export function readWalkMap(floor: HTMLElement, scale: number): WalkMap {
  const door = floor.querySelector("[data-door]")
  return {
    // 걷는 곳은 건물 벽 안쪽 바닥([data-walk])이다. 건물이 카메라 틀 안에서
    // 통째로 움직이므로 틀 전체를 쓰면 바깥 벽 위를 걷는다. 위쪽 HEAD_ROOM은
    // 집사 머리가 벽 위로 잘리지 않게 둔다(위쪽 벽면은 장애물이라 어차피 못 간다).
    floor: walkBox(floor, scale),
    door: door ? boxIn(door, floor, scale) : null,
    obstacles: [...floor.querySelectorAll("[data-obstacle]")].map((el) =>
      boxIn(el, floor, scale)
    ),
  }
}

function walkBox(floor: HTMLElement, scale: number): Box {
  const inner = floor.querySelector("[data-walk]")
  if (inner) {
    // 안쪽 테두리(2px)는 벽이다. 좌우는 몸통(32px)이 벽에 걸치지 않게 발(12px)
    // 바깥으로 10px을 더 띄운다.
    const box = boxIn(inner, floor, scale)
    const side = 2 + (32 - FOOT_W) / 2
    return { l: box.l + side, t: box.t + 2, r: box.r - side, b: box.b - 2 }
  }
  // 바닥 크기는 집사를 뺀 내용(첫 자식)으로 잰다. scrollWidth를 쓰면 집사가
  // 걸어가며 스크롤 영역을 넓혀 끝없이 걸어갈 수 있다.
  const first = floor.firstElementChild as HTMLElement | null
  return {
    l: 0,
    t: HEAD_ROOM,
    r: first?.offsetWidth ?? floor.clientWidth,
    b: first?.offsetHeight ?? floor.clientHeight,
  }
}

const feet = (x: number, y: number): Box => ({
  l: x - FOOT_W / 2,
  t: y - FOOT_H,
  r: x + FOOT_W / 2,
  b: y,
})

const inside = (a: Box, b: Box) =>
  a.l >= b.l && a.r <= b.r && a.t >= b.t && a.b <= b.b

const overlaps = (a: Box, b: Box) =>
  a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

/** 발밑이 바닥 안에 있고 아무 장애물에도 걸리지 않으면 설 수 있다. */
export function canStand(map: WalkMap, x: number, y: number) {
  const foot = feet(x, y)
  return (
    inside(foot, map.floor) && !map.obstacles.some((box) => overlaps(foot, box))
  )
}

/** 위쪽 정문 바로 안쪽. 집사가 처음 서는 자리. */
export function doorSpot(map: WalkMap) {
  // 정문은 위쪽 벽면을 뚫고 내려오므로 그 아래 끝 바로 밑에 선다.
  if (map.door)
    return { x: (map.door.l + map.door.r) / 2, y: map.door.b + FOOT_H + 2 }
  return { x: map.floor.l + FOOT_W * 2, y: map.floor.t + FOOT_H + 2 }
}

// 길 찾기 격자 한 칸(바닥 안쪽 px). 발 크기보다 작아 좁은 문도 지난다.
const CELL = 6

/**
 * 집사가 (from)에서 target 가까이(책상 앞) 갈 길. 칸 격자 위에서 넓이 우선으로
 * 찾아 지나갈 점들을 돌려준다. 못 가면 null.
 */
export function findPath(
  map: WalkMap,
  from: { x: number; y: number },
  target: { x: number; y: number },
  reach = 20
): { x: number; y: number }[] | null {
  const cols = Math.ceil(map.floor.r / CELL) + 1
  const rows = Math.ceil(map.floor.b / CELL) + 1
  const at = (c: number, r: number) => ({ x: c * CELL, y: r * CELL })
  const start = [Math.round(from.x / CELL), Math.round(from.y / CELL)]
  const seen = new Int32Array(cols * rows).fill(-1)
  const id = (c: number, r: number) => r * cols + c
  const queue = [id(start[0], start[1])]
  seen[queue[0]] = queue[0]
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]
    const c = cell % cols
    const r = Math.floor(cell / cols)
    const p = at(c, r)
    if (Math.hypot(p.x - target.x, p.y - target.y) <= reach) {
      const path: { x: number; y: number }[] = []
      for (let step = cell; step !== seen[step]; step = seen[step])
        path.unshift(at(step % cols, Math.floor(step / cols)))
      return path
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const next = id(nc, nr)
      if (seen[next] !== -1) continue
      const q = at(nc, nr)
      if (!canStand(map, q.x, q.y)) continue
      seen[next] = cell
      queue.push(next)
    }
  }
  return null
}
