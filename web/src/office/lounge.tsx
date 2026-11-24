

import { useEffect, useMemo, useRef, useState } from "react"

import { OFFICE_SCALE } from "@/office/pixel"
import { ITEMS, type Grid } from "@/office/sprite-data"
import { Movable } from "@/office/props-drag"
import { AddedProps } from "@/office/props-palette"
import { TowerCats } from "@/office/tower-cats"
import type { SessionAgent } from "@/lib/agent-office"
import { cn } from "@/lib/utils"
import {
  drawGrid,
  drawItem,
  TILE,
  type ItemName,
} from "@/office/sprites"

// 소품이 놓이는 자리. 소품마다 정해진 자리에만 놓는다(묶음 타입이 강제한다).
//   벽에 거는 것: 벽면에 건다.      벽에 붙여 세우는 것: 벽 앞에 세운다.
//   바닥에 두는 것: 벽 가구 앞 바닥. 문 옆·책상 위 소품은 아직 쓰지 않는다.
export type HangItem = Extract<
  ItemName,
  | "clock"
  | "corkboard"
  | "wallTV"
  | "airConditioner"
  | "frame"
  | "whiteboard"
  | "window"
  | "windowNight"
  | "poster"
>
type WallItem = Extract<
  ItemName,
  | "bookshelf"
  | "lockers"
  | "cabinet"
  | "vendingMachine"
  | "waterCooler"
  | "miniFridge"
>
// 문 옆에 두는 것. 서는 옷걸이(coatRack)는 키가 커서 건물 벽면(32px)에
// 들어가지 않아, 벽에 거는 외투 걸이판(wallHooks)을 쓴다.
export type DoorItem = Extract<ItemName, "umbrellaStand" | "coatRack" | "wallHooks">
type FloorItem = Extract<
  ItemName,
  | "sofa"
  | "floorLamp"
  | "bench"
  | "rug"
  | "plant"
  | "monstera"
  | "beanBag"
  | "heater"
  | "catTower"
  | "catBed"
  | "scratcher"
  | "yarn"
  | "box"
  | "foodBowl"
  | "trash"
  | "cactus"
>

// 빈 바닥에 놓는 휴게 공간 묶음. 벽 가구는 낮은 벽에 붙여 세우고 바닥 소품은
// 그 앞에 둔다. 방마다 id로 하나를 골라 늘 같은 모습이다.
type LoungeSet = { wall: WallItem[]; floor: FloorItem[] }
const SETS: LoungeSet[] = [
  { wall: ["bookshelf"], floor: ["monstera", "sofa", "heater", "floorLamp"] },
  { wall: ["waterCooler", "miniFridge"], floor: ["bench", "trash"] },
  { wall: ["bookshelf"], floor: ["catTower", "scratcher", "catBed", "yarn"] },
  { wall: ["vendingMachine", "miniFridge"], floor: ["box", "foodBowl"] },
  { wall: ["cabinet", "bookshelf"], floor: ["heater", "beanBag", "catBed"] },
  { wall: ["lockers", "cabinet"], floor: ["monstera", "trash"] },
]
// 어느 묶음도 들어가지 않는 낮은 자리(안쪽 방 아래 좁은 틈)에 놓는 작은
// 묶음. 방마다 고르는 묶음(SETS)과 따로 두어, 이것을 늘려도 다른 방의
// 휴게 공간이 바뀌지 않는다. 벽 가구가 없으면 낮은 벽도 세우지 않는다.
const COMPACT_SETS: LoungeSet[] = [
  { wall: ["miniFridge"], floor: ["foodBowl"] },
  { wall: [], floor: ["catBed", "yarn"] },
  { wall: [], floor: ["beanBag", "trash"] },
  { wall: [], floor: ["cactus", "box"] },
]
// 벽 가구가 기대는 낮은 벽의 높이(px)
const LOW_WALL_H = 12

// 이보다 키 작은 소품(고양이 침대·털실 등)은 집사가 밟고 지나간다.
const OBSTACLE_H = 13

const size = (name: ItemName) => ({
  w: ITEMS[name][0].length,
  h: ITEMS[name].length,
})

// FNV-1a. 이름 끝만 다른 방(…/myrepo, …/myrepo-web)도 고르게 흩어진다.
function hash(text: string) {
  let value = 0x811c9dc5
  for (const char of text) {
    value ^= char.charCodeAt(0)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value
}

// 피할 묶음 번호들. 바깥 방 묶음과, 같은 줄에 먼저 놓인 휴게 공간 묶음이다.
function skipped(parentSeed?: string, avoid: number[] = []) {
  const skip = new Set(avoid)
  if (parentSeed !== undefined) skip.add(hash(parentSeed) % SETS.length)
  return skip
}

/**
 * 방 id로 고른 휴게 소품 묶음 번호. 바깥 방이나 같은 줄 휴게 공간(avoid)과
 * 같으면 다음 묶음을 쓴다. 다 겹치면 처음 고른 것을 쓴다.
 */
export function loungeSet(
  seed: string,
  parentSeed?: string,
  avoid: number[] = []
) {
  const skip = skipped(parentSeed, avoid)
  const pick = hash(seed) % SETS.length
  for (let step = 0; step < SETS.length; step++) {
    const index = (pick + step) % SETS.length
    if (!skip.has(index)) return index
  }
  return pick
}

/** 소품 하나. 키가 큰 바닥 소품은 집사가 지나가지 못한다(wall이면 벽 장식). */
export function Prop({
  name,
  wall = false,
  grid,
}: {
  name: ItemName
  wall?: boolean
  /** 같은 크기의 다른 그림으로 그릴 때(지금 시각의 벽시계) */
  grid?: Grid
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = size(name)
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    if (grid) drawGrid(ctx, grid, 0, 0)
    else drawItem(ctx, name, 0, 0)
  }, [name, w, h, grid])
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      aria-hidden="true"
      data-obstacle={!wall && h >= OBSTACLE_H ? "" : undefined}
      className="block shrink-0 [image-rendering:pixelated]"
      style={{ width: w * OFFICE_SCALE, height: h * OFFICE_SCALE }}
    />
  )
}

// 묶음 하나를 놓는 데 드는 폭과 높이(px). 위로 8px(top-2) 띄우고, 아래는
// 책상 구역 여백(p-2)이 받쳐 준다.
function measure(set: LoungeSet) {
  const rowW = (names: ItemName[]) =>
    names.reduce((sum, name) => sum + size(name).w * OFFICE_SCALE, 0) +
    8 * Math.max(0, names.length - 1)
  const rowH = (names: ItemName[]) =>
    names.length
      ? Math.max(...names.map((name) => size(name).h)) * OFFICE_SCALE
      : 0
  const wallW = rowW(set.wall) + 16
  return {
    set,
    wallW,
    needW: Math.max(wallW, rowW(set.floor)),
    needH:
      (set.wall.length ? LOW_WALL_H + rowH(set.wall) + 12 : 0) +
      rowH(set.floor),
  }
}

/**
 * 책상 구역 아래 빈 바닥을 휴게 공간으로 채운다. 같은 줄의 큰 방 때문에
 * 책상 아래가 비는 경우에만, 소품이 다 들어갈 만큼 남을 때 놓는다.
 */
export function Lounge({
  seed,
  parentSeed,
  avoid,
  neighbors,
  agents,
  now = 0,
}: {
  seed: string
  /** 바깥 방 id. 같은 묶음이 겹치지 않게 한다. */
  parentSeed?: string
  /** 같은 줄에 먼저 놓인 휴게 공간 묶음 번호. 나란히 같은 묶음이 서지 않게 한다. */
  avoid?: number[]
  /** 같은 줄 다른 휴게 공간들이 고른 묶음(오른쪽 것 포함). 자리가 모자라 다른 묶음을 고를 때 피한다. */
  neighbors?: number[]
  /** 이 책상 구역의 고양이들. 쉬는 시간에 캣타워에 올라온다. */
  agents?: SessionAgent[]
  now?: number
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) =>
      setRoom({ w: entry.contentRect.width, h: entry.contentRect.height })
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  // 방마다 고른 묶음을 먼저 놓는다. 자리가 모자라면 들어가는 묶음 가운데
  // 하나를 놓는데, 같은 줄의 좁은 휴게 공간들이 모두 같은 작은 묶음으로
  // 몰리지 않게 줄에서의 차례(avoid 개수)대로 돌아가며 고른다. 바깥 방
  // 묶음은 다른 게 들어가면 피한다. 하나도 안 들어가면 비워 둔다.
  const first = loungeSet(seed, parentSeed, avoid)
  const fitsIn = (plan: ReturnType<typeof measure>) =>
    room.h >= plan.needH + 8 && room.w >= plan.needW
  // 바깥 방·옆 휴게 공간 묶음을 피하되, 피하고 나서 남는 게 없으면 피하지 않는다.
  const prefer = (plans: ReturnType<typeof measure>[], skip: Set<number>) => {
    const rest = plans.filter((plan) => !skip.has(SETS.indexOf(plan.set)))
    return rest.length ? rest : plans
  }
  const regular = prefer(
    prefer(
      SETS.map((each) => measure(each)).filter(fitsIn),
      skipped(parentSeed)
    ),
    new Set(neighbors)
  )
  const candidates = regular.length
    ? regular
    : COMPACT_SETS.map((each) => measure(each)).filter(fitsIn)
  const own = measure(SETS[first])
  const placed = fitsIn(own)
    ? own
    : candidates[(avoid?.length ?? 0) % Math.max(1, candidates.length)]
  const fits = placed !== undefined
  const { set, wallW } = placed ?? measure(SETS[first])
  return (
    <div ref={boxRef} data-move-bounds="" data-drop-room={seed} className="relative min-h-0 grow">
      <AddedProps room={seed} />
      {fits ? (
        <div className="absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
          {/* 낮은 벽과 거기에 붙여 세운 가구 */}
          {set.wall.length ? (
            <div className="flex flex-col" style={{ width: wallW }}>
              <div
                aria-hidden="true"
                data-obstacle=""
                className="border-2 border-[#2b2a36]"
                style={{
                  height: LOW_WALL_H,
                  backgroundImage: `url("${TILE.wall}")`,
                  backgroundSize: "64px 32px",
                }}
              />
              <div className="flex items-start justify-center gap-2">
                {set.wall.map((name, index) => (
                  <Movable key={`${name}-${index}`} room={seed} item={`wall:${index}:${name}`}>
                    <Prop name={name} />
                  </Movable>
                ))}
              </div>
            </div>
          ) : null}
          {/* 그 앞 바닥 */}
          <div className="flex items-end gap-2">
            {set.floor.map((name, index) => (
              <Movable
                key={`${name}-${index}`}
                room={seed}
                item={`floor:${index}:${name}`}
              >
                {name === "catTower" && agents ? (
                  // 쉬는 고양이가 찾아오는 캣타워(office-canvas.tsx가 찾는다)
                  <span data-cat-tower="" className="relative block">
                    <Prop name={name} />
                    <TowerCats agents={agents} now={now} />
                  </span>
                ) : (
                  <Prop name={name} />
                )}
              </Movable>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
