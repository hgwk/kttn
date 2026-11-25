import { t } from "@/i18n"
import { useEffect, useRef, useState, type ReactNode } from "react"

import {
  assignSeats,
  FolderRoom,
  roomId,
} from "@/kttn/folder-room"
import { MAX_DESKS } from "@/kttn/kttn-draw"
import { planRooms, type PlanNode } from "@/kttn/room-plan"
import { RoomFrame } from "@/kttn/room-frame"
import { cn } from "@/lib/utils"
import { ScrollHint } from "@/kttn/scroll-hint"
import {
  compactFolderTree,
  nestAreas,
  kttnCounts,
  areaKey,
  areaName,
  type AreaNest,
  type SessionAgent,
} from "@/lib/kttn"
import type { FolderNode, RepoArea } from "@/lib/kttn-layout"


// 카메라 틀 높이 가운데 구역이 못 쓰는 높이(px): TV 틀 위아래 14, 건물 위
// 벽면 34, 건물 벽 16, 복도 32와 아래 여백 12.
const FLOOR_CHROME = 108
/**
 * 건물 하나가 이 PC다. 저장소마다 구역이 하나씩 건물 복도를 따라 늘어서고,
 * 저장소 안 폴더는 그 구역 안의 방이 된다. 다른 구역 폴더 안에서 연
 * 구역(예: ~/Project 안의 myrepo)은 그 바깥 구역 안에 들어간다. 건물 벽 안쪽 바닥만 스크롤되고,
 * 오른쪽 칸(월드맵)은 그대로 있다.
 */
export function Building({
  name,
  areas,
  agents,
  now,
  levelUps,
  side,
}: {
  /** 건물(이 PC) 이름 */
  name: string
  areas: RepoArea[]
  agents: SessionAgent[]
  now: number
  levelUps: Set<string>
  /** 오른쪽 칸. 넓으면 옆에, 좁으면 아래에 둔다. */
  side: ReactNode
}) {
  // 카메라 틀 높이에서 TV 틀·건물 위 벽면·건물 벽·복도와 여백을 뺀 높이가
  // 구역이 쓸 수 있는 높이다(배율을 되돌린 안쪽 px).
  const floorRef = useRef<HTMLDivElement>(null)
  const [roomsH, setRoomsH] = useState(0)
  useEffect(() => {
    const box = floorRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) =>
      setRoomsH(Math.max(0, Math.round(entry.contentRect.height) - FLOOR_CHROME))
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const trees = areas.map((area) => ({
    area,
    tree: compactFolderTree(area.tree),
    root: area.root,
  }))
  // 자리 번호는 건물 전체에서 구역 순서대로 매긴다.
  const seats = new Map<string, number>()
  for (const { tree } of trees) assignSeats(tree, seats)
  // 다른 구역 폴더 안에 있는 구역은 그 구역 안에 들어간다.
  const nested = nestAreas(trees, (entry) => entry.root)
  type Entry = (typeof trees)[number]
  // 방 배치 계산(room-plan.ts)에 넘길 방 나무. 화면의 방과 같은 id를 쓴다.
  const folderPlan = (key: string, node: FolderNode): PlanNode => ({
    id: roomId(key, node.path),
    desks: Math.min(node.agents.length, MAX_DESKS),
    children: node.children.map((child) => folderPlan(key, child)),
  })
  const areaPlan = ({ item, children }: AreaNest<Entry>): PlanNode => {
    const plan = folderPlan(areaKey(item.area), item.tree)
    return {
      ...plan,
      children: [...plan.children, ...children.map(areaPlan)],
    }
  }
  // 홈 폴더 구역(~)은 다른 구역을 모두 감싸므로 건물 자체다. 그 책상과
  // 폴더 방은 건물 바닥에 바로 놓고, 다른 구역은 건물 안에 세운다.
  const home = nested.find((node) => node.item.root === "")
  const insideAreas = home
    ? [...home.children, ...nested.filter((node) => node !== home)]
    : nested
  const plans = planRooms(
    [
      ...(home
        ? folderPlan(areaKey(home.item.area), home.item.tree).children
        : []),
      ...insideAreas.map(areaPlan),
    ],
    // 폭은 제한하지 않는다(건물은 카메라 틀 안에서 가로로 스크롤된다). 대신
    // 화면 높이를 넘지 않는 안에서 가장 좁게 놓아, 아래를 비워 두고 옆으로만
    // 늘어서지 않게 한다.
    Number.POSITIVE_INFINITY,
    roomsH
  )
  const cards = { now, seats, levelUps, plans }
  const areaId = (entry: Entry) =>
    roomId(areaKey(entry.area), entry.tree.path)
  const renderArea = (
    { item, children }: AreaNest<Entry>,
    depth: number,
    parentId?: string
  ): ReactNode => (
    <FolderRoom
      key={areaKey(item.area)}
      node={item.tree}
      project={areaKey(item.area)}
      name={areaName(item.area.project, name)}
      cards={cards}
      depth={depth}
      parentId={parentId}
      inner={children.map((child) => ({
        id: areaId(child.item),
        room: renderArea(child, depth + 1, areaId(item)),
      }))}
    />
  )
  const counts = kttnCounts(agents)
  const outside = agents.length - seats.size

  return (
    // 바깥 창 틀 없이 TV 틀 하나만 둔다. 건물 이름은 벽 이름표에, 냥이 수는
    // 아래 상태 줄에 있다. 확인이 필요하면 TV 틀 테두리가 주황이 된다.
    <section aria-labelledby="kttn-building" className="h-full min-h-0">
      <h2 id="kttn-building" className="sr-only">
        {t("building.heading", {
          name,
          areas: areas.length,
          cats: agents.length,
        })}
        {counts.needsYou
          ? t("building.headingNeedsYou", { n: counts.needsYou })
          : ""}
        {outside > 0 ? t("building.headingOutside", { n: outside }) : ""}
      </h2>
      {/* 화면 배율에 따라 안쪽 너비가 달라지므로 창 너비(컨테이너)로 옆 칸을 정한다. */}
      <div className="@container h-full min-h-0">
        {/* 노트북 폭에서도 월드맵은 오른쪽에 둔다(건물은 가로로 스크롤된다).
            아주 좁아 아래로 내려갈 때는 건물이 높이의 2/3를 쓴다. */}
        {/* 확대·축소는 건물을 보려는 것이라 옆 칸은 배율을 되돌려 같은 크기로 둔다. */}
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-3 @3xl:grid-cols-[minmax(0,1fr)_calc(21rem/var(--kttn-zoom,1))] @3xl:grid-rows-1">
          <div
            ref={floorRef}
            className={cn(
              "relative flex min-h-0 min-w-0",
              counts.needsYou > 0 && "[&>div:last-child]:border-amber-400"
            )}
          >
            <ScrollHint />
            {home ? (
              <FolderRoom
                node={home.item.tree}
                project={areaKey(home.item.area)}
                name={name}
                cards={cards}
                depth={0}
                inner={insideAreas.map((node) => ({
                  id: areaId(node.item),
                  room: renderArea(node, 1, areaId(home.item)),
                }))}
              />
            ) : (
              <RoomFrame
                label={name}
                ariaLabel={t("building.label", { name, n: areas.length })}
                kind="building"
                // 구역이 하나뿐이면 건물 복도 없이 정문 바로 아래에 둔다
                // (구역 안 복도와 두 겹이 되지 않게).
                corridor={insideAreas.length > 1}
                wing={insideAreas.map((node) => renderArea(node, 1))}
              />
            )}
          </div>
          {/* 월드맵이 남는 높이를 채워, 옆 건물 바닥과 아래 끝이
              맞는다(내용이 넘치면 그대로 스크롤된다). */}
          <div
            className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 overflow-y-auto"
            style={{ zoom: "calc(1 / var(--kttn-zoom, 1))" }}
          >
            {side}
          </div>
        </div>
      </div>
    </section>
  )
}
