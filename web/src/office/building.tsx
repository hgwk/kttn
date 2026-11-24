import { t } from "@/i18n"
import type { ReactNode } from "react"

import {
  assignSeats,
  FolderRoom,
  roomId,
} from "@/office/folder-room"
import { MAX_DESKS } from "@/office/office-draw"
import { planRooms, type PlanNode } from "@/office/room-plan"
import { RoomFrame } from "@/office/room-frame"
import { cn } from "@/lib/utils"
import { ScrollHint } from "@/office/scroll-hint"
import {
  compactFolderTree,
  nestOffices,
  officeCounts,
  officeKey,
  officeName,
  type OfficeNest,
  type SessionAgent,
} from "@/lib/agent-office"
import type { FolderNode, RepoOffice } from "@/lib/agent-office-layout"

/**
 * 건물 하나가 이 PC다. 저장소마다 사무실이 하나씩 건물 복도를 따라 늘어서고,
 * 저장소 안 폴더는 그 사무실 안의 방이 된다. 다른 사무실 폴더 안에서 연
 * 사무실(예: ~/Project 안의 myrepo)은 그 바깥 사무실 안에 들어간다. 건물 벽 안쪽 바닥만 스크롤되고,
 * 오른쪽 칸(월드맵)은 그대로 있다.
 */
export function Building({
  name,
  offices,
  agents,
  now,
  levelUps,
  side,
}: {
  /** 건물(이 PC) 이름 */
  name: string
  offices: RepoOffice[]
  agents: SessionAgent[]
  now: number
  levelUps: Set<string>
  /** 오른쪽 칸. 넓으면 옆에, 좁으면 아래에 둔다. */
  side: ReactNode
}) {
  const trees = offices.map((office) => ({
    office,
    tree: compactFolderTree(office.tree),
    root: office.root,
  }))
  // 자리 번호는 건물 전체에서 사무실 순서대로 매긴다.
  const seats = new Map<string, number>()
  for (const { tree } of trees) assignSeats(tree, seats)
  // 다른 사무실 폴더 안에 있는 사무실은 그 사무실 안에 들어간다.
  const nested = nestOffices(trees, (entry) => entry.root)
  type Entry = (typeof trees)[number]
  // 방 배치 계산(room-plan.ts)에 넘길 방 나무. 화면의 방과 같은 id를 쓴다.
  const folderPlan = (key: string, node: FolderNode): PlanNode => ({
    id: roomId(key, node.path),
    desks: Math.min(node.agents.length, MAX_DESKS),
    children: node.children.map((child) => folderPlan(key, child)),
  })
  const officePlan = ({ item, children }: OfficeNest<Entry>): PlanNode => {
    const plan = folderPlan(officeKey(item.office), item.tree)
    return {
      ...plan,
      children: [...plan.children, ...children.map(officePlan)],
    }
  }
  // 홈 폴더 사무실(~)은 다른 사무실을 모두 감싸므로 건물 자체다. 그 책상과
  // 폴더 방은 건물 바닥에 바로 놓고, 다른 사무실은 건물 안에 세운다.
  const home = nested.find((node) => node.item.root === "")
  const insideOffices = home
    ? [...home.children, ...nested.filter((node) => node !== home)]
    : nested
  const plans = planRooms(
    [
      ...(home
        ? folderPlan(officeKey(home.item.office), home.item.tree).children
        : []),
      ...insideOffices.map(officePlan),
    ],
    // 폭은 제한하지 않는다. 방은 오른쪽으로 먼저 늘어서고(키가 낮게), 건물은
    // 카메라 틀 안에서 가로로도 스크롤된다.
    Number.POSITIVE_INFINITY
  )
  const cards = { now, seats, levelUps, plans }
  const officeId = (entry: Entry) =>
    roomId(officeKey(entry.office), entry.tree.path)
  const renderOffice = (
    { item, children }: OfficeNest<Entry>,
    depth: number,
    parentId?: string
  ): ReactNode => (
    <FolderRoom
      key={officeKey(item.office)}
      node={item.tree}
      project={officeKey(item.office)}
      name={officeName(item.office.project, name)}
      cards={cards}
      depth={depth}
      parentId={parentId}
      inner={children.map((child) => ({
        id: officeId(child.item),
        room: renderOffice(child, depth + 1, officeId(item)),
      }))}
    />
  )
  const counts = officeCounts(agents)
  const outside = agents.length - seats.size

  return (
    // 바깥 창 틀 없이 TV 틀 하나만 둔다. 건물 이름은 벽 이름표에, 냥이 수는
    // 아래 상태 줄에 있다. 확인이 필요하면 TV 틀 테두리가 주황이 된다.
    <section aria-labelledby="office-building" className="h-full min-h-0">
      <h2 id="office-building" className="sr-only">
        {t("building.heading", {
          name,
          offices: offices.length,
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
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-3 @3xl:grid-cols-[minmax(0,1fr)_calc(21rem/var(--office-zoom,1))] @3xl:grid-rows-1">
          <div
            className={cn(
              "relative flex min-h-0 min-w-0",
              counts.needsYou > 0 && "[&>div:last-child]:border-amber-400"
            )}
          >
            <ScrollHint />
            {home ? (
              <FolderRoom
                node={home.item.tree}
                project={officeKey(home.item.office)}
                name={name}
                cards={cards}
                depth={0}
                inner={insideOffices.map((node) => ({
                  id: officeId(node.item),
                  room: renderOffice(node, 1, officeId(home.item)),
                }))}
              />
            ) : (
              <RoomFrame
                label={name}
                ariaLabel={t("building.label", { name, n: offices.length })}
                kind="building"
                // 사무실이 하나뿐이면 건물 복도 없이 정문 바로 아래에 둔다
                // (사무실 안 복도와 두 겹이 되지 않게).
                corridor={insideOffices.length > 1}
                wing={insideOffices.map((node) => renderOffice(node, 1))}
              />
            )}
          </div>
          {/* 월드맵이 남는 높이를 채워, 옆 건물 바닥과 아래 끝이
              맞는다(내용이 넘치면 그대로 스크롤된다). */}
          <div
            className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 overflow-y-auto"
            style={{ zoom: "calc(1 / var(--office-zoom, 1))" }}
          >
            {side}
          </div>
        </div>
      </div>
    </section>
  )
}
