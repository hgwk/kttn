import { useEffect, useRef, type CSSProperties } from "react"
import { createPortal } from "react-dom"

import { CAT_HEAD, familyColor, type deskLayout } from "@/kttn/kttn-draw"
import { WALK_SPEED } from "@/kttn/kttn-walk"
import { SIT_OFFSET } from "@/lib/desk-layout"
import { loungeExit } from "@/lib/desk-walk"
import type { Point } from "@/lib/walk-grid"
import { loungePath, pathLength, pointAlong } from "@/kttn/lounge-walk"
import { PIXEL_SCALE } from "@/kttn/pixel"
import type { VisitAction } from "@/kttn/props-catalog"
import { coatFor, drawCat, type CatDir, type CatPose } from "@/kttn/sprites"
import type { Spots } from "@/kttn/use-tower"
import { cutTrip, perchFor, spotFor, trips } from "@/kttn/visit-sync"
import { type SessionAgent } from "@/lib/kttn"
import { idleActivity } from "@/lib/kttn-acts"

// 휴게 공간에 나온 고양이. 쉬는 고양이가 캣타워에 올라앉거나 소품을 찾아가
// 하는 일을 그린다. 책상 구역 그림판의 고양이가 아래 끝에 닿아 사라지면
// (visit-sync.ts) 그 자리에서 캣타워나 소품까지 걸어 들어오고, 돌아갈 때는 같은
// 길로 걸어 나간다. 밥그릇·물 분수 앞에서는 고개를 숙여 먹고, 침대·해먹·고타쓰
// 위와 캣타워 층에서는 자고, 레코드플레이어·피아노 앞에서는 고개를 까딱이고,
// 장난감 곁에서는 뛰어논다. 어느 소품에 갈지는 대사(cat-speech.tsx)와 같은
// 계산(propPick)으로 고른다. 나와 있는 동안 대사 상자도 이 고양이를 따라온다.

type Action = VisitAction | "perch"

const POSE: Record<Action, CatPose> = {
  eat: "eat",
  nap: "sleep",
  groove: "hum",
  play: "walk",
  perch: "sleep",
}

// 캣타워(20×29) 층마다 고양이가 엎드리는 자리. 발밑 가운데(논리 픽셀)다.
const PERCHES = [
  { x: 10, y: 6 },
  { x: 9, y: 17 },
]

// 휴게 공간에서 제자리. 자는 고양이는 소품 위 가운데, 캣타워에서는 층 위,
// 나머지는 소품 왼쪽 옆 바닥에 선다. transform은 걷는 동안 옮기는 데 쓴다.
function placeFor(action: Action, perch: number): CSSProperties {
  if (action === "perch") {
    const at = PERCHES[perch]
    return {
      left: (at.x - 8) * PIXEL_SCALE,
      top: (at.y - 16) * PIXEL_SCALE,
    }
  }
  if (action === "nap")
    return { left: "50%", bottom: "35%", marginLeft: -8 * PIXEL_SCALE }
  return { left: -12 * PIXEL_SCALE, bottom: 0 }
}

// 이 고양이의 대사 상자를 휴게 공간의 고양이 머리 위로 옮긴다. 상자는 책상
// 구역 기준 백분율 자리라 그 바깥(100% 넘게)으로도 놓인다.
function follow(key: string, cat: DOMRect, ratio: number) {
  const speech = document.querySelector<HTMLElement>(
    `[data-speech-for="${CSS.escape(key)}"]`
  )
  const box = speech?.parentElement?.getBoundingClientRect()
  if (!speech || !box?.width || !box.height) return
  const x = cat.left + cat.width / 2
  const y = cat.bottom - (SIT_OFFSET + CAT_HEAD) * PIXEL_SCALE * ratio
  speech.style.left = `${((x - box.left) / box.width) * 100}%`
  speech.style.top = `${((y - box.top) / box.height) * 100}%`
  speech.style.zIndex = "45"
}

function VisitCat({
  agent,
  kind,
  action,
  perch,
  exit,
}: {
  agent: SessionAgent
  kind: "tower" | "prop"
  action: Action
  perch: number
  /** 책상 구역 아래 끝, 그림판 고양이가 사라진 곳(화면 자리) */
  exit: () => DOMRect | undefined
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // 그리는 고리에서 읽는 지금 상태. 깨면 걸어 나가 돌아간다(그림판이 화면 밖이라
  // 멈춰 있어도).
  const awake = useRef(false)
  awake.current = agent.state !== "sleeping"
  useEffect(() => {
    let frame = 0
    // 지금 옮겨 둔 만큼. 제자리를 잴 때 뺀다.
    let shift = { x: 0, y: 0 }
    // 문에서 제자리까지의 길(제자리 기준)과 잰 시각, 지난 장면에 걷고 있었는지
    let path: Point[] | null = null
    // 길을 찾은 휴게 공간·소품 자리의 서명과 마지막으로 잰 시각
    let sig = ""
    let checkedAt = 0
    let moving = false
    // 화면에 보이는지. 보이지 않는 동안은 소품 자리를 다시 재지 않는다.
    let onScreen = true
    const watch = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
    })
    if (ref.current) watch.observe(ref.current)
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const el = ref.current
      const ctx = el?.getContext("2d")
      const trip = trips.get(agent.key)
      const t = Date.now()
      if (!el || !ctx) return
      if (
        trip?.kind !== kind ||
        t >= trip.until ||
        t < trip.arrived
      ) {
        el.style.visibility = "hidden"
        // 다음 나들이는 그때의 소품 자리로 길을 다시 잰다.
        path = null
        sig = ""
        return
      }
      trip.shown = true
      const box = el.getBoundingClientRect()
      const ratio = box.width / (el.offsetWidth || box.width) || 1
      const door = exit()
      // 제자리 발밑(화면 자리). 지금 옮겨 둔 만큼을 빼서 잰다.
      const origin = {
        x: box.left + box.width / 2 - shift.x * ratio,
        y: box.bottom - shift.y * ratio,
      }
      // 문(사라진 곳)에서 제자리까지 다른 소품을 피해 가는 길. 나들이를 시작할
      // 때 찾고, 머무는 동안은 1초마다 소품 자리만 재서 바뀌었을 때만 다시
      // 찾는다(소품을 옮기면 비키고, 다음 걸음은 새 길로 간다).
      const recheck = !moving && onScreen && t - checkedAt > 1000
      if (!path || recheck) {
        checkedAt = t
        const keep = action === "nap" || action === "perch"
        const next = door
          ? loungePath(el, door, origin, ratio, keep, sig)
          : { path: [{ x: 0, y: 0 }], sig: "" }
        if (next) {
          path = next.path
          sig = next.sig
        }
      }
      if (!path) return
      const dist = pathLength(path)
      const walkMs = dist / PIXEL_SCALE / WALK_SPEED
      trip.outMs = walkMs
      if (awake.current) cutTrip(trip, t)
      const into = t - trip.arrived
      const left = trip.until - t
      const done = walkMs ? Math.min(1, into / walkMs, left / walkMs) : 1
      const leaving = left < into
      // 문에서 제자리 쪽으로 간 거리. 나갈 때는 같은 길을 거꾸로 걷는다.
      const along = pointAlong(path, done * dist)
      shift = along.at
      const ax = leaving ? -along.dx : along.dx
      const ay = leaving ? -along.dy : along.dy
      const dir: CatDir =
        Math.abs(ax) > Math.abs(ay)
          ? ax > 0
            ? "right"
            : "left"
          : ay > 0
            ? "front"
            : "back"
      const walking = done < 1
      moving = walking
      // 까딱이기·뛰어놀기는 1초마다 몸을 한 칸 올렸다 내린다.
      const bob = action === "groove" || action === "play"
      const up = !walking && bob && Math.floor(t / 1000) % 2 ? 1 : 0
      ctx.clearRect(0, 0, 16, 17)
      drawCat(
        ctx,
        8,
        16 - up,
        coatFor(agent.key),
        familyColor(agent.family),
        walking ? "walk" : POSE[action],
        walking ? dir : action === "play" ? "left" : "front",
        t
      )
      el.style.visibility = ""
      el.style.transform = `translate(${shift.x}px, ${shift.y}px)`
      // 걷는 동안은 다른 소품보다 앞에 둔다.
      el.style.zIndex = walking ? "35" : ""
      follow(agent.key, el.getBoundingClientRect(), ratio)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      watch.disconnect()
    }
  }, [agent.key, agent.family, kind, action, perch, exit])
  return (
    <canvas
      ref={ref}
      width={16}
      height={17}
      aria-hidden="true"
      className="pointer-events-none absolute z-20 [image-rendering:pixelated]"
      style={{
        visibility: "hidden",
        width: 16 * PIXEL_SCALE,
        height: 17 * PIXEL_SCALE,
        ...placeFor(action, perch),
      }}
    />
  )
}

/**
 * 이 책상 구역에서 휴게 공간에 나온 고양이들. 캣타워나 소품 요소 안에 그린다.
 * 나설 차례이거나(현황 시각 기준) 아직 나와 있는(나들이 기록 기준) 고양이를
 * 놓아 두고, 실제로 보일지는 나들이 기록(trips)으로 장면마다 정한다.
 */
export function VisitCats({
  agents,
  now,
  nearby,
  layout,
}: {
  agents: SessionAgent[]
  now: number
  nearby: Spots
  layout: ReturnType<typeof deskLayout>
}) {
  const doors = useRef(new Map<string, HTMLElement>())
  const exits = useRef(new Map<string, () => DOMRect | undefined>())
  return agents.map((agent, index) => {
    const trip = trips.get(agent.key)
    // 현황은 몇 초 늦게 오므로 나들이가 끝난 직후에도 잠깐 둔다.
    const out = trip && now < trip.until + 3000 ? trip.kind : undefined
    const activity = idleActivity(agent, now, nearby, agents, true)
    const kind =
      out ?? (activity === "tower" || activity === "prop" ? activity : null)
    if (!kind) return null
    let spot: HTMLElement | undefined
    let action: Action | undefined
    let perch = 0
    if (kind === "tower") {
      spot = nearby.towerEl
      action = "perch"
      perch = perchFor(agent.key, now, spot)
      // 층이 모자라면(캣타워에 셋 이상) 올라가지 않고 돌아간다.
      if (perch >= PERCHES.length) spot = undefined
    } else {
      spot = spotFor(agent.key, now, nearby.spots)
      action = spot?.dataset.visit as VisitAction | undefined
    }
    if (!spot || !action) {
      // 나와 있는데 갈 곳이 없어졌으면(소품을 치움 등) 바로 돌아가게 한다.
      // 그대로 두면 아무 데도 안 그려진 채 대사만 굳는다.
      if (out && trip) {
        cutTrip(trip, Date.now())
        trip.shown = false
      }
      return null
    }
    const end = loungeExit(layout, index)
    let exit = exits.current.get(agent.key)
    if (!exit) {
      exit = () => doors.current.get(agent.key)?.getBoundingClientRect()
      exits.current.set(agent.key, exit)
    }
    return (
      <span key={agent.key}>
        <span
          aria-hidden="true"
          ref={(el) => {
            if (el) doors.current.set(agent.key, el)
            else doors.current.delete(agent.key)
          }}
          className="pointer-events-none absolute size-0"
          style={{ left: `${(end.x / layout.w) * 100}%`, top: "100%" }}
        />
        {createPortal(
          <VisitCat
            agent={agent}
            kind={kind}
            action={action}
            perch={perch}
            exit={exit}
          />,
          spot
        )}
      </span>
    )
  })
}
