import { t } from "@/i18n"
import { useKttnSettings } from "@/kttn/kttn-settings"
import type { ReactNode } from "react"

import { type RoomPlan, squareCols } from "@/kttn/room-plan"
import { cn } from "@/lib/utils"
import { Lounge, loungeSet } from "@/kttn/lounge"
import { KttnCanvas } from "@/kttn/kttn-canvas"
import { MAX_DESKS, deskLayout } from "@/kttn/kttn-draw"
import { PIXEL_SCALE } from "@/kttn/pixel"
import { RoomFrame } from "@/kttn/room-frame"
import type { Floor } from "@/kttn/sprites"
import { areaName, shortFolder } from "@/lib/kttn"
import type { FolderNode } from "@/lib/kttn-layout"

/** 월드맵 지점이 가리키는 방 앵커. */
export function roomId(project: string, path: string) {
  const slug = `${project}/${path}`.replace(/[^\p{L}\p{N}]+/gu, "-")
  // 홈 구역(~)은 글자가 남지 않으므로 home으로 부른다.
  return `room-${slug.replace(/^-+|-+$/g, "") || "home"}`
}

// 칸막이 방 바닥. 방 이름으로 골라 새로 고쳐도 같은 방은 같은 바닥이다.
const ROOM_FLOORS: Floor[] = ["check", "carpet", "parquet", "stone", "terrazzo"]
function roomFloor(id: string): Floor {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.codePointAt(0)!) % 9973
  return ROOM_FLOORS[hash % ROOM_FLOORS.length]
}

/** 방 순서(위에서 아래, 바깥에서 안쪽)대로 자리 번호를 1번부터 매긴다. */
export function assignSeats(
  node: FolderNode,
  seats = new Map<string, number>()
) {
  for (const agent of node.agents.slice(0, MAX_DESKS))
    seats.set(agent.key, seats.size + 1)
  for (const child of node.children) assignSeats(child, seats)
  return seats
}

/**
 * 폴더 하나가 방 하나다. 하위 폴더는 이 방 안의 작은 방으로 들어가고,
 * 세션은 자기가 일하는 폴더의 방 책상에 앉고, 하는 일은 머리 위 상자에 적힌다. 깊이마다 바닥 무늬를 바꿔
 * 어느 방 안에 있는지 구분한다.
 */
export type RoomCards = {
  now: number
  seats: Map<string, number>
  levelUps: Set<string>
  /** 방마다 계산해 둔 폭과 안쪽 방 순서(room-plan.ts) */
  plans: Map<string, RoomPlan>
}

export function FolderRoom({
  node,
  project,
  cards,
  depth = 0,
  name,
  inner,
  parentId,
  loungeAvoid,
}: {
  node: FolderNode
  project: string
  cards: RoomCards
  depth?: number
  /** 이름표를 바꿔 달 때. 저장소 구역은 저장소 이름을 쓴다. */
  name?: string
  /** 이 구역 폴더 안에 있는 다른 구역(저장소). 하위 폴더 방과 함께 선다. */
  inner?: { id: string; room: ReactNode }[]
  /** 바깥 방 id(휴게 소품이 겹치지 않게 쓴다) */
  parentId?: string
  /** 같은 줄에 먼저 놓인 휴게 공간 묶음 번호(바깥 방이 정한다) */
  loungeAvoid?: number[]
}) {
  const { buildingName } = useKttnSettings()
  const seated = node.agents.slice(0, MAX_DESKS)
  const outside = node.agents.length - seated.length
  const waiting = node.agents.some((agent) => agent.state === "needs_you")
  const label =
    name ??
    (depth === 0 ? areaName(project, buildingName) : shortFolder(node.name))
  const fullLabel = name ?? (depth === 0 ? label : `${node.name}/`)
  const id = roomId(project, node.path)
  const plan = cards.plans.get(id)
  // 안쪽 방(하위 폴더 + 안쪽 구역)을 계산해 둔 순서로 놓는다.
  const rooms: { id: string; child?: FolderNode; room?: ReactNode }[] = [
    ...node.children.map((child) => ({
      id: roomId(project, child.path),
      child,
    })),
    ...(inner ?? []),
  ]
  const rank = (roomKey: string) => {
    const index = plan?.order.indexOf(roomKey) ?? -1
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }
  rooms.sort((a, b) => rank(a.id) - rank(b.id))

  // 같은 줄의 휴게 공간은 왼쪽(책상 구역)부터 차례로 서로 다른 묶음을
  // 고른다. 안쪽 방의 책상 구역 휴게 공간과 그 방 아래 휴게 공간을 모두 센다.
  const deskLounge = seated.length > 0 && (rooms.length > 0 || depth === 1)
  const rowPicks: number[] = deskLounge
    ? [loungeSet(id, parentId, loungeAvoid)]
    : []
  const innerAvoid = new Map<string, number[]>()
  const belowAvoid = new Map<string, number[]>()
  const belowSlot = new Map<string, number>()
  for (const entry of rooms) {
    innerAvoid.set(entry.id, [...rowPicks])
    rowPicks.push(loungeSet(entry.id, id, innerAvoid.get(entry.id)))
    if (depth > 0) {
      belowAvoid.set(entry.id, [...rowPicks])
      belowSlot.set(entry.id, rowPicks.length)
      rowPicks.push(
        loungeSet(`${entry.id}:below`, entry.id, belowAvoid.get(entry.id))
      )
    }
  }

  return (
    <RoomFrame
      id={id}
      label={label}
      title={fullLabel}
      ariaLabel={t("room.label", { name: fullLabel, n: node.agents.length })}
      floor={depth === 0 ? "wood" : roomFloor(id)}
      kind={depth === 0 ? "building" : "partition"}
      // 칸막이 방은 계산해 둔 폭을 그대로 쓴다(줄어들지 않는다).
      className={depth > 1 ? "flex-none" : depth === 1 ? "grow" : undefined}
      width={depth === 0 ? undefined : plan?.width}
      // 건물 바로 안의 구역은 계산한 폭을 최소로 두고 줄의 남는 폭까지 늘어난다.
      stretch={depth === 1}
      deskWidth={
        seated.length
          ? deskLayout(
              seated.length,
              plan?.deskCols ?? squareCols(seated.length)
            ).w * PIXEL_SCALE
          : 0
      }
      alert={waiting}
      // 책상과 안쪽 방이 같은 줄에 서면 책상 아래가 비므로 휴게 공간을 둔다.
      // 건물 바로 안의 구역은 건물 높이만큼 늘어나므로 안쪽 방이 없어도 둔다.
      lounge={
        deskLounge ? (
          <Lounge
            seed={id}
            parentSeed={parentId}
            avoid={loungeAvoid}
            desks
          />
        ) : undefined
      }
      // 같은 줄의 큰 방보다 키가 작은 안쪽 방은 아래가 비므로 거기에도 휴게
      // 공간을 둔다(줄 높이만큼 늘어난 칸에 들어갈 때만 보인다).
      wing={
        rooms.length
          ? rooms.map((entry) => (
              // 건물 바로 안의 구역은 건물 바닥 아래까지 늘인다(줌을
              // 줄여도 아래에 빈 바닥이 남지 않는다).
              <div
                key={entry.id}
                className={cn(
                  "flex flex-col self-stretch",
                  depth === 0 ? "grow [&>section]:grow" : "flex-none"
                )}
              >
                {entry.child ? (
                  <FolderRoom
                    node={entry.child}
                    project={project}
                    cards={cards}
                    depth={depth + 1}
                    parentId={id}
                    loungeAvoid={innerAvoid.get(entry.id)}
                  />
                ) : (
                  entry.room
                )}
                {depth === 0 ? null : (
                  <Lounge
                    seed={`${entry.id}:below`}
                    parentSeed={entry.id}
                    avoid={belowAvoid.get(entry.id)}
                    neighbors={rowPicks.filter(
                      (_, index) => index !== belowSlot.get(entry.id)
                    )}
                  />
                )}
              </div>
            ))
          : undefined
      }
      tags={
        <>
          {waiting ? (
            <span className="bg-amber-400 px-1 py-px text-xs text-amber-950">
              {t("room.needsYou")}
            </span>
          ) : null}
          {outside > 0 ? (
            <span className="bg-[#2b2a36]/80 px-1 py-px text-xs text-[#f7f2e8]">
              {t("room.outside", { n: outside })}
            </span>
          ) : null}
        </>
      }
    >
      {seated.length ? (
        <KttnCanvas
          label={label}
          agents={seated}
          now={cards.now}
          levelUps={cards.levelUps}
        />
      ) : null}
    </RoomFrame>
  )
}
