

import { useEffect, useRef } from "react"

import { familyColor } from "@/office/office-draw"
import { OFFICE_SCALE } from "@/office/pixel"
import { coatFor, drawCat } from "@/office/sprites"
import { type SessionAgent } from "@/lib/agent-office"
import {
  IDLE_SLOT_MS,
  TOWER_WALK_MS,
  idleActivity,
} from "@/lib/agent-office-acts"

// 캣타워(20×29) 층마다 고양이가 엎드리는 자리. 발밑 가운데(논리 픽셀)다.
const PERCHES = [
  { x: 10, y: 6 },
  { x: 9, y: 17 },
]

function PerchCat({
  agent,
  perch,
}: {
  agent: SessionAgent
  perch: { x: number; y: number }
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, 16, 16)
    drawCat(
      ctx,
      8,
      16,
      coatFor(agent.key),
      familyColor(agent.family),
      "sleep",
      "front",
      0
    )
  }, [agent.key, agent.family])
  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      aria-hidden="true"
      className="pointer-events-none absolute [image-rendering:pixelated]"
      style={{
        width: 16 * OFFICE_SCALE,
        height: 16 * OFFICE_SCALE,
        left: (perch.x - 8) * OFFICE_SCALE,
        top: (perch.y - 16) * OFFICE_SCALE,
      }}
    />
  )
}

/**
 * 쉬는 시간에 캣타워 차례가 온 고양이들(층마다 한 마리, 최대 두 마리).
 * 책상에서 걸어 나가는 시간(TOWER_WALK_MS)이 지난 뒤에 올라앉는다.
 */
export function TowerCats({
  agents,
  now,
}: {
  agents: SessionAgent[]
  now: number
}) {
  if (now % IDLE_SLOT_MS < TOWER_WALK_MS) return null
  const sitters = agents
    .filter((agent) => idleActivity(agent, now, true, agents) === "tower")
    .slice(0, PERCHES.length)
  return sitters.map((agent, index) => (
    <PerchCat key={agent.key} agent={agent} perch={PERCHES[index]} />
  ))
}
