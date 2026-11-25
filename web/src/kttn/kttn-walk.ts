// kttn 고양이의 걸음. 길(격자 위에서 찾은 꺾은선, walk-grid.ts)을 따라 한
// 프레임씩 옮기고, 찾아가기·산책·캣타워·소품 나들이의 단계를 넘긴다. 길은 늘
// 지금 선 곳에서 찾는다. 무엇을 할지는 cat-move.ts가 정하고 그림은
// kttn-canvas.tsx가 그린다.
import type { DeskLayout } from "@/kttn/kttn-draw"
import type { CatDir } from "@/kttn/sprites"
import { holdTrip } from "@/kttn/visit-sync"
import { loungeExit, standBeside, strollPoint } from "@/lib/desk-walk"
import { route, type Grid, type Point } from "@/lib/walk-grid"

export const WALK_SPEED = 0.05 // 논리 픽셀/ms

// 다른 고양이에게 가서 얘기하는 중. go(가는 중) → stay(얘기) → back(돌아오는 중).
export type Visit = {
  stage: "go" | "stay" | "back"
  /** 찾아간 고양이 key */
  to: string
  /** stay가 끝나는 시각(그림 시계 t) */
  until: number
  /**
   * 휴게 공간의 캣타워나 소품에 가는 긴 나들이. until을 미리 정해 두고, 가 있는
   * 동안은 휴게 공간 쪽(visit-cats.tsx)이 그린다.
   */
  kind?: "tower" | "prop"
  /** 찾아가서 머무는 시간(ms). 없으면 VISIT_STAY_MS. */
  stayMs?: number
  /** 찾아간 고양이 곁에 엎드려 같이 잔다(얘기 말풍선 없이) */
  nap?: boolean
}
export type Walker = Point & {
  path: Point[]
  dir: CatDir
  visit?: Visit
  /** 이미 걸어가 본 메시지 시각. 같은 메시지는 한 번만 찾아간다. */
  played?: string
  /** 이미 산책을 다녀온 쉬는 시간 칸(IDLE_SLOT_MS 단위). 칸마다 한 번만 간다. */
  strolled?: number
  /** 이미 캣타워나 소품에 다녀온 칸. 산책을 다녀온 칸에도 한 번은 간다. */
  went?: number
  /** 퇴근길을 걷는 중 */
  leaving?: boolean
  /** 퇴근길 끝에서 문밖으로 나갔다 */
  out?: boolean
  /** 길을 찾은 배치(바뀌면 지금 선 곳에서 다시 찾는다, cat-move.ts) */
  plan?: string
}

// 찾아가서 얘기하는 시간(ms)
export const VISIT_STAY_MS = 3_000
// 캣타워나 소품에 걸어갔다 와 머물 만한 남은 시간(ms). 이보다 짧으면 안 간다.
const MIN_TRIP_MS = 12_000

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
 * 칸(slot, slotMs 단위)에는 하나씩 한 번만 간다. 캣타워와 소품에는 그 칸이 끝날
 * 때까지 있으므로, 남은 시간이 걸어갔다 올 만큼도 안 되면 나서지 않는다.
 */
export function startIdleWalk(
  walker: Walker,
  activity: string,
  slot: number,
  room: { layout: DeskLayout; grid: Grid; index: number },
  slotMs: number,
  strollStartMs: number,
  now: number
) {
  const { layout, grid, index } = room
  if (activity === "stroll") {
    // 산책은 1분 첫머리에만 나선다(늦게 나서면 대사가 다른 일로 먼저 바뀐다).
    if (walker.strolled === slot || now - slot * slotMs > strollStartMs) return
    walker.strolled = slot
    const path = route(grid, walker, strollPoint(layout, index))
    if (!path.length) return
    walker.path = path
    walker.visit = { stage: "go", to: "", until: 0 }
    return
  }
  if (activity !== "tower" && activity !== "prop") return
  if (walker.went === slot || (slot + 1) * slotMs - now < MIN_TRIP_MS) return
  walker.went = slot
  // 휴게 공간 입구(책상 구역 아래 끝)까지 걸어가 거기서 휴게 공간으로 넘어간다.
  const path = route(grid, walker, loungeExit(layout, index))
  if (!path.length) return
  walker.path = path
  walker.visit = {
    stage: "go",
    to: "",
    until: (slot + 1) * slotMs,
    kind: activity,
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
  agent: { key: string; state: string } | undefined,
  /** 지금 선 곳에서 자리로 돌아가는 길 */
  home: () => Point[]
) {
  const visit = walker.visit
  if (!visit) return
  const rest = agent?.state === "sleeping"
  if (visit.kind && agent && holdTrip(agent.key, visit, t, rest)) {
    visit.stage = "back"
    walker.path = home()
    return
  }
  if (visit.stage === "go" && walker.path.length === 0) {
    visit.stage = "stay"
    if (!visit.kind) visit.until = t + (visit.stayMs ?? VISIT_STAY_MS)
    walker.dir = "left"
  } else if (visit.stage === "stay" && t >= visit.until) {
    visit.stage = "back"
    walker.path = home()
  } else if (visit.stage === "back" && walker.path.length === 0) {
    walker.visit = undefined
    return
  }
  if (visit.to && visit.stage !== "back" && !present(visit.to)) {
    visit.stage = "back"
    walker.path = home()
  }
}

/**
 * 같은 방의 다른 자리(to)로 찾아가 얘기하러(nap이면 곁에서 같이 자러) 출발한다.
 * stayMs만큼 머문다. 길이 없으면 나서지 않는다.
 */
export function startVisit(
  walker: Walker,
  room: { layout: DeskLayout; grid: Grid },
  to: number,
  toKey: string,
  extra: { stayMs?: number; nap?: boolean } = {}
) {
  const path = route(room.grid, walker, standBeside(room.layout, to))
  if (!path.length) return
  walker.path = path
  walker.visit = { stage: "go", to: toKey, until: 0, ...extra }
}

/** 캣타워나 소품에 가 있는 동안. 책상 구역에는 그리지 않는다(휴게 공간에 그린다). */
export const awayOnVisit = (walker: Walker) =>
  Boolean(walker.visit?.kind && walker.visit.stage === "stay")
