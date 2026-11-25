// 휴게 공간에 나온 고양이(visit-cats.tsx)의 길. 책상 구역 아래 끝(문)에서
// 찾아가는 소품이나 캣타워 앞 제자리까지, 다른 소품과 낮은 벽을 밟지 않게
// 돌아간다. 화면의 휴게 공간([data-move-bounds])과 그 안의 소품([data-movable])·
// 장애물([data-obstacle]) 상자를 재서 길 계산(lib/lounge-route.ts)에 넘긴다.
// 소품은 끌어서 옮길 수 있으므로 걷기 시작할 때마다 새로 잰다.
import { loungeGrid, loungeRoute } from "@/lib/lounge-route"
import type { Box, Grid, Point } from "@/lib/walk-grid"

// 찾아가는 소품(없으면 휴게 공간)마다 만든 격자와 그 서명. 같은 소품에 간
// 고양이들은 격자를 함께 쓰고, 소품이 그대로면 다시 만들지 않는다.
const grids = new WeakMap<Element, { sig: string; grid: Grid }>()

const rounded = (box: Box) =>
  `${Math.round(box.l)},${Math.round(box.t)},${Math.round(box.r)},${Math.round(box.b)}`

/**
 * 문(door, 화면 자리)에서 제자리(origin, 화면 자리)까지 가는 꺾은선. 좌표는
 * 제자리 발밑을 (0, 0)으로 둔 확대 전 화면 px다. 첫 점은 문, 마지막 점은 실제로
 * 설 자리다(벽이나 이웃 소품에 걸치면 옆으로 비킨다. keep이면 그대로).
 * 휴게 공간과 소품 상자를 반올림한 서명이 last와 같으면 null을 돌려준다(길을
 * 다시 찾지 않는다). 휴게 공간 기준으로 재므로 화면을 스크롤해도 같다.
 */
export function loungePath(
  cat: HTMLElement,
  door: Point,
  origin: Point,
  ratio: number,
  keep: boolean,
  last: string
): { path: Point[]; sig: string } | null {
  const lounge = cat.closest<HTMLElement>("[data-move-bounds]")
  const base = lounge?.getBoundingClientRect()
  const local = (x: number, y: number) => ({
    x: (x - (base?.left ?? origin.x)) / ratio,
    y: (y - (base?.top ?? origin.y)) / ratio,
  })
  const from = local(door.x, door.y)
  const home = local(origin.x, origin.y)
  const toHome = (p: Point) => ({ x: p.x - home.x, y: p.y - home.y })
  if (!lounge || !base) {
    const sig = "none"
    if (sig === last) return null
    return { sig, path: [from, { x: from.x, y: home.y }, home].map(toHome) }
  }
  // 찾아가는 소품(고양이 그림이 그 안에 들어 있다)은 장애물에서 뺀다.
  const own = cat.closest("[data-movable]")
  const rel = (rect: DOMRect): Box => {
    const a = local(rect.left, rect.top)
    const b = local(rect.right, rect.bottom)
    return { l: a.x, t: a.y, r: b.x, b: b.y }
  }
  const props = [
    ...lounge.querySelectorAll("[data-movable], [data-obstacle]"),
  ]
    .filter(
      (other) =>
        other !== own &&
        !own?.contains(other) &&
        !other.contains(cat) &&
        // 소품 안의 그림은 그 소품으로 센다(props-drag.tsx와 같은 규칙).
        (other.matches("[data-movable]") || !other.closest("[data-movable]"))
    )
    .map((other) => rel(other.getBoundingClientRect()))
  const room = rel(base)
  const gridSig = [room, ...props].map(rounded).join(" ") + ` ${Math.round(from.y)}`
  const sig = `${gridSig} ${Math.round(from.x)} ${Math.round(home.x)},${Math.round(home.y)} ${keep}`
  if (sig === last) return null
  const key = own ?? lounge
  let cached = grids.get(key)
  if (cached?.sig !== gridSig) {
    cached = { sig: gridSig, grid: loungeGrid(room, props, from) }
    grids.set(key, cached)
  }
  const { path } = loungeRoute(room, props, from, home, {
    keep,
    grid: cached.grid,
  })
  return { sig, path: path.map(toHome) }
}

/** 꺾은선의 길이 */
export function pathLength(path: Point[]) {
  let total = 0
  for (let k = 1; k < path.length; k++)
    total += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y)
  return total
}

/** 꺾은선 처음에서 d만큼 간 점과 그 구간의 방향(dx, dy) */
export function pointAlong(path: Point[], d: number) {
  let rest = Math.max(0, d)
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]
    const b = path[k]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (rest <= len || k === path.length - 1) {
      const f = len ? Math.min(1, rest / len) : 1
      return {
        at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
        dx: b.x - a.x,
        dy: b.y - a.y,
      }
    }
    rest -= len
  }
  return { at: path[path.length - 1] ?? { x: 0, y: 0 }, dx: 0, dy: 0 }
}
