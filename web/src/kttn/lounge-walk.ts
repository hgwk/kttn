// 휴게 공간에 나온 고양이(visit-cats.tsx)의 길. 책상 구역 아래 끝(문)에서
// 찾아가는 소품이나 캣타워 앞 제자리까지, 다른 소품과 낮은 벽을 밟지 않게
// 돌아간다. 화면의 휴게 공간([data-move-bounds])과 그 안의 소품([data-movable])·
// 장애물([data-obstacle]) 상자를 재서 길 계산(lib/lounge-route.ts)에 넘긴다.
// 소품은 끌어서 옮길 수 있으므로 걷기 시작할 때마다 새로 잰다.
import { loungeRoute } from "@/lib/lounge-route"
import type { Box, Point } from "@/lib/walk-grid"

/**
 * 문(door)에서 제자리까지 가는 꺾은선. 좌표는 원래 제자리 발밑(origin, 화면
 * 자리)을 (0, 0)으로 둔 확대 전 화면 px다. 첫 점은 문, 마지막 점은 실제로 설
 * 자리다(벽이나 이웃 소품에 걸치면 옆으로 비킨다, lib/lounge-route.ts).
 */
export function loungePath(
  cat: HTMLElement,
  door: Point,
  origin: Point,
  ratio: number
): Point[] {
  const home = { x: 0, y: 0 }
  const lounge = cat.closest<HTMLElement>("[data-move-bounds]")
  if (!lounge) return [door, { x: door.x, y: 0 }, home]
  // 찾아가는 소품(고양이 그림이 그 안에 들어 있다)은 장애물에서 뺀다.
  const own = cat.closest("[data-movable]")
  const rel = (rect: DOMRect): Box => ({
    l: (rect.left - origin.x) / ratio,
    t: (rect.top - origin.y) / ratio,
    r: (rect.right - origin.x) / ratio,
    b: (rect.bottom - origin.y) / ratio,
  })
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
  return loungeRoute(rel(lounge.getBoundingClientRect()), props, door, home)
    .path
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
