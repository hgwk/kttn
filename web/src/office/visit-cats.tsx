import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import { familyColor } from "@/office/office-draw"
import { OFFICE_SCALE } from "@/office/pixel"
import type { VisitAction } from "@/office/props-catalog"
import { coatFor, drawCat, type CatPose } from "@/office/sprites"
import type { Spots } from "@/office/use-tower"
import { type SessionAgent } from "@/lib/agent-office"
import {
  IDLE_SLOT_MS,
  TOWER_WALK_MS,
  idleActivity,
  propPick,
} from "@/lib/agent-office-acts"

// 쉬는 고양이가 휴게 공간의 소품을 찾아가 하는 일을 그린다. 고양이는 책상에서
// 걸어 나간 뒤(TOWER_WALK_MS) 소품 곁에 나타난다. 밥그릇·물 분수 앞에서는
// 고개를 숙여 먹고, 침대·해먹·고타쓰 위에서는 자고, 레코드플레이어·피아노
// 앞에서는 고개를 까딱이고, 장난감 곁에서는 뛰어논다. 어느 소품에 갈지는
// 대사(cat-speech.tsx)와 같은 계산(propPick)으로 고른다.

const POSE: Record<VisitAction, CatPose> = {
  eat: "groom",
  nap: "sleep",
  groove: "alert",
  play: "walk",
}

function VisitCat({
  agent,
  action,
  now,
}: {
  agent: SessionAgent
  action: VisitAction
  now: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // 까딱이기·뛰어놀기는 1초마다 몸을 한 칸 올렸다 내린다.
  const beat = action === "groove" || action === "play" ? (now / 1000) % 2 : 0
  const up = Math.floor(beat) === 1 ? 1 : 0
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, 16, 17)
    drawCat(
      ctx,
      8,
      16 - up,
      coatFor(agent.key),
      familyColor(agent.family),
      POSE[action],
      action === "play" ? "left" : "front",
      now
    )
  }, [agent.key, agent.family, action, now, up])
  // 자는 고양이는 소품 위 가운데에, 나머지는 소품 왼쪽 옆 바닥에 선다.
  const nap = action === "nap"
  return (
    <canvas
      ref={ref}
      width={16}
      height={17}
      aria-hidden="true"
      className="pointer-events-none absolute z-20 [image-rendering:pixelated]"
      style={{
        width: 16 * OFFICE_SCALE,
        height: 17 * OFFICE_SCALE,
        left: nap ? "50%" : -12 * OFFICE_SCALE,
        bottom: nap ? "35%" : 0,
        transform: nap ? "translateX(-50%)" : undefined,
      }}
    />
  )
}

/** 이 책상 구역에서 소품을 찾아간 고양이들. 각 소품 요소 안에 그린다. */
export function VisitCats({
  agents,
  now,
  nearby,
}: {
  agents: SessionAgent[]
  now: number
  nearby: Spots
}) {
  if (!nearby.spots.length || now % IDLE_SLOT_MS < TOWER_WALK_MS) return null
  return agents.map((agent) => {
    if (idleActivity(agent, now, nearby, agents, true) !== "prop") return null
    const spot =
      nearby.spots[propPick(agent.key, now, nearby.spots.length)]
    const action = spot?.dataset.visit as VisitAction | undefined
    if (!spot || !action) return null
    return createPortal(
      <VisitCat agent={agent} action={action} now={now} />,
      spot,
      agent.key
    )
  })
}
