import { t } from "@/i18n"
import { useOfficeSettings } from "@/office/office-settings"
import { PixelIcon } from "@/office/pixel-icon"
import { roomId } from "@/office/folder-room"
import type { ReactNode } from "react"

import {
  compactFolderTree,
  nestOffices,
  officeKey,
  officeName,
  shortFolder,
  type OfficeNest,
  type AgentState,
  type OfficeAutomation,
} from "@/lib/agent-office"
import type { FolderNode, RepoOffice } from "@/lib/agent-office-layout"
import { cn } from "@/lib/utils"

const RESTING = new Set<AgentState>(["idle", "done", "sleeping", "ended"])

type Tone = "alert" | "busy" | "rest" | "empty"

const TONE_COLOR: Record<Tone, string> = {
  alert: "#f59e0b",
  busy: "#4caf5f",
  rest: "#8fa0b8",
  empty: "#c9b79c",
}

// 그 지점과 하위 방에 있는 고양이 수
function countAll(node: FolderNode): number {
  return node.children.reduce(
    (sum, child) => sum + countAll(child),
    node.agents.length
  )
}

function toneOf(node: FolderNode): Tone {
  const all: FolderNode[] = [node]
  const states: AgentState[] = []
  while (all.length) {
    const next = all.pop() as FolderNode
    states.push(...next.agents.map((agent) => agent.state))
    all.push(...next.children)
  }
  if (states.includes("needs_you")) return "alert"
  if (states.some((state) => !RESTING.has(state))) return "busy"
  return states.length ? "rest" : "empty"
}

// 길 끝 지점 모양. 폴더 지점과 기계실이 함께 쓴다.
const SPOT_LINK =
  "relative z-10 inline-flex w-fit max-w-full items-center gap-1.5 border-2 border-[#2b2a36] bg-[#f4efe6] px-1.5 py-0.5 text-xs text-[#2b2a33] hover:bg-white focus-visible:outline-2 focus-visible:outline-amber-400"

// 윗 지점에서 내려오는 흙길
function Road() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0 left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-[#b08850]"
    />
  )
}

/** 마을 안 기계실. 실패가 있으면 빨강, 돌고 있으면 초록, 아니면 쉬는 색이다. */
function MachineSpot({ automations }: { automations: OfficeAutomation[] }) {
  const failed = automations.some((automation) => automation.state === "failed")
  const running = automations.some(
    (automation) => automation.state === "running"
  )
  const color = failed
    ? "#dc2626"
    : running
      ? TONE_COLOR.busy
      : automations.length
        ? TONE_COLOR.rest
        : TONE_COLOR.empty
  return (
    <li className="relative grid gap-1.5 pl-5">
      <Road />
      <a
        href="#office-automations"
        className={SPOT_LINK}
        // 기계실은 늘 화면 오른쪽에 있으니 화면을 움직이지 않는다.
        onClick={(event) => event.preventDefault()}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 border-2 border-[#2b2a36]",
            failed && "animate-pulse motion-reduce:animate-none"
          )}
          style={{ backgroundColor: color }}
        />
        <PixelIcon name="gear" />
        <span>{t("automation.machineRoom")}</span>
        {automations.length ? (
          <span className="shrink-0 bg-[#2b2a36] px-1 text-[10px] text-[#f7f2e8]">
            {t("automation.machines", { n: automations.length })}
          </span>
        ) : null}
      </a>
    </li>
  )
}

function Spot({
  node,
  project,
  pick,
  townName = "",
  town = false,
  inner = false,
  extra,
}: {
  node: FolderNode
  project: string
  /** 마을(사무실) 이름. 앵커용 project와 따로 받는다. */
  townName?: string
  /** 다른 마을(사무실) 폴더 안에 있는 마을. 바깥 마을에서 흙길로 잇는다. */
  inner?: boolean
  /** 누르면 건물 바닥을 그 방(앵커 id)으로 스크롤한다. */
  pick?: (anchor: string) => void
  town?: boolean
  /** 하위 지점 뒤에 잇는 지점(기계실). */
  extra?: ReactNode
}) {
  const tone = toneOf(node)
  const count = town ? countAll(node) : node.agents.length
  return (
    <li className={cn("relative grid gap-1.5", (!town || inner) && "pl-5")}>
      {town && !inner ? null : <Road />}
      <a
        href={`#${roomId(project, node.path)}`}
        className={SPOT_LINK}
        onClick={(event) => {
          if (!pick) return
          event.preventDefault()
          pick(roomId(project, node.path))
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 border-2 border-[#2b2a36]",
            tone === "alert" && "animate-pulse motion-reduce:animate-none"
          )}
          style={{ backgroundColor: TONE_COLOR[tone] }}
        />
        {town ? <PixelIcon name="house" /> : null}
        {/* 긴 폴더 이름은 두 줄로 꺾지 않고 한 줄에서 줄인다(전체 이름은 title). */}
        <span
          className="min-w-0 truncate"
          title={town ? undefined : `${node.name}/`}
        >
          {town ? townName : shortFolder(node.name)}
        </span>
        {/* 마을(건물)은 건물 전체, 폴더 지점은 그 방에 앉은 고양이만 센다. */}
        {count ? (
          <span className="shrink-0 bg-[#2b2a36] px-1 text-[10px] text-[#f7f2e8]">
            {t("map.cats", { n: count })}
          </span>
        ) : null}
        {tone === "alert" ? (
          <span className="shrink-0 bg-amber-400 px-1 text-[10px] text-amber-950">
            !
          </span>
        ) : null}
      </a>
      {node.children.length || extra ? (
        <ul className="relative ml-1.5 grid gap-1.5 border-l-2 border-[#b08850] pt-0.5 pb-1">
          {node.children.map((child) => (
            <Spot key={child.path} node={child} project={project} pick={pick} />
          ))}
          {extra}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * 오른쪽 월드맵. 저장소는 마을, 폴더는 흙길로 이어진 지점이다. 지점 색은
 * 그 아래에서 일하는 고양이 상태(확인 필요 > 작업 > 쉬는 중)를 따르고,
 * 누르면 해당 방으로 간다.
 */
export function WorldMap({
  offices,
  homeProject,
  automations,
  onPick,
}: {
  offices: RepoOffice[]
  /** 기계실이 들어 있는 마을(설정의 홈 저장소). */
  homeProject: string
  automations: OfficeAutomation[]
  onPick?: (anchor: string) => void
}) {
  const { buildingName } = useOfficeSettings()
  const renderTown = (
    { item: office, children }: OfficeNest<RepoOffice>,
    inner: boolean
  ): ReactNode => (
    <Spot
      key={officeKey(office)}
      node={compactFolderTree(office.tree)}
      project={officeKey(office)}
      townName={officeName(office.project, buildingName)}
      pick={onPick}
      town
      inner={inner}
      extra={
        office.project === homeProject || children.length ? (
          <>
            {office.project === homeProject ? (
              <MachineSpot automations={automations} />
            ) : null}
            {children.map((child) => renderTown(child, true))}
          </>
        ) : undefined
      }
    />
  )

  return (
    <div
      // 지점 목록의 칸은 지도 폭을 넘지 않는다. 긴 폴더 이름은 넓히지 않고 줄인다.
      className="relative grid grid-cols-[minmax(0,1fr)] gap-4 overflow-x-auto border-2 border-[#3f6b36] p-3 [&_li]:grid-cols-[minmax(0,1fr)] [&_ul]:grid-cols-[minmax(0,1fr)]"
      style={{
        backgroundColor: "#8cc06e",
        backgroundImage:
          "repeating-conic-gradient(#82b764 0% 25%, transparent 0% 50%)",
        backgroundSize: "16px 16px",
      }}
    >
      {offices.length === 0 ? (
        <p className="bg-[#f4efe6] p-2 text-xs text-[#2b2a33]">
          {t("map.noTown")}
        </p>
      ) : (
        // 건물과 같이 이 PC의 폴더 위치대로 마을을 겹친다(홈 > Project > 저장소).
        nestOffices(offices, (office) => office.root).map((node) => (
          <ul
            key={officeKey(node.item)}
            aria-label={t("map.label", {
              name: officeName(node.item.project, buildingName),
            })}
          >
            {renderTown(node, false)}
          </ul>
        ))
      )}
      <p className="flex flex-wrap gap-x-2 gap-y-1 bg-[#f4efe6]/90 px-1.5 py-1 text-[10px] text-[#2b2a33]">
        {(
          [
            ["alert", t("map.alert")],
            ["busy", t("map.busy")],
            ["rest", t("map.rest")],
          ] as const
        ).map(([tone, label]) => (
          <span key={tone} className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-3 border-2 border-[#2b2a36]"
              style={{ backgroundColor: TONE_COLOR[tone] }}
            />
            {label}
          </span>
        ))}
      </p>
    </div>
  )
}
