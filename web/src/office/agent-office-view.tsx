import { PixelIcon } from "@/office/pixel-icon"
import { useEffect, useRef, useState } from "react"

import {
  AutomationRoom,
  MachineRoom,
} from "@/office/automation-room"
import { EmptyOffice } from "@/office/empty-office"
import { OfficeStage } from "@/office/office-stage"
import {
  OfficeCapture,
  TOOL_BUTTON,
} from "@/office/office-capture"
import { Building } from "@/office/building"
import { Hud, HudItem } from "@/office/game-ui"
import { WorldMap } from "@/office/world-map"
import { CatNamesContext } from "@/office/cat-names"
import {
  catNames,
  officeCounts,
  levelUpKeys,
  stateSince,
} from "@/lib/agent-office"
import { repoOffices } from "@/lib/agent-office-layout"
import { fetchSnapshot, type ServerSnapshot } from "@/lib/snapshot"
import { lang, t } from "@/i18n"
import { OfficeSettingsContext, useOfficeSettings } from "@/office/office-settings"

const POLL_MS = 2000
const MAX_LEVEL_UPS = 40
// 레벨이 오른 뒤 LEVEL UP! 을 보이는 시간
const LEVEL_UP_MS = 6000
// 퇴근한 고양이가 자리에서 문까지 걸어 나가는 동안 자리를 남겨 두는 시간
const LEAVE_MS = 8000

// 화면 시각은 이 컴퓨터의 시간대다. 게임 화면의 날짜·시계처럼 짧게 보인다.
function gameClock(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(lang(), {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function AgentOfficeView({ initial }: { initial: ServerSnapshot }) {
  return (
    <OfficeSettingsContext
      value={{
        buildingName: initial.settings.officeName,
        homeRepo: initial.settings.homeRepo,
      }}
    >
      <OfficeView initial={initial} />
    </OfficeSettingsContext>
  )
}

function OfficeView({ initial }: { initial: ServerSnapshot }) {
  const { buildingName, homeRepo } = useOfficeSettings()
  const [snapshot, setSnapshot] = useState(initial)
  const [stale, setStale] = useState(false)
  // 폴링 사이에 레벨이 오른 세션과 그 시각
  const [levels, setLevels] = useState<{ key: string; at: string }[]>([])
  const shown = useRef(initial)
  const areaRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === areaRef.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  // 사무실 영역만 브라우저 전체화면으로 띄운다. Esc로도 빠져나온다.
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void areaRef.current?.requestFullscreen()
  }

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const next = await fetchSnapshot()
        if (!cancelled) {
          const ups = levelUpKeys(shown.current.agents, next.agents)
          shown.current = next
          if (ups.length)
            setLevels((old) =>
              [
                ...ups.map((key) => ({ key, at: next.generatedAt })),
                ...old,
              ].slice(0, MAX_LEVEL_UPS)
            )
          setSnapshot(next)
          setStale(false)
        }
      } catch {
        if (!cancelled) setStale(true)
      }
    }
    const timer = window.setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const now = Date.parse(snapshot.generatedAt)
  const counts = officeCounts(snapshot.agents)
  const names = catNames(snapshot.agents)
  // 퇴근한 세션은 문까지 걸어 나갈 동안(LEAVE_MS)만 자리에 남고, 그 뒤로는
  // 자리도 방도 차지하지 않는다(상태바의 퇴근 수에만 남는다).
  const working = snapshot.agents.filter(
    (agent) =>
      agent.state !== "ended" || now - Date.parse(stateSince(agent)) < LEAVE_MS
  )
  const offices = repoOffices(working)
  // 월드맵 지점을 누르면 건물 바닥을 그 방으로 스크롤한다.
  const showRoom = (anchor: string) => {
    const floor = document.querySelector<HTMLElement>("[data-floor]")
    const room = document.getElementById(anchor)
    if (!floor || !room) return
    // 방은 오른쪽으로도 펼쳐지므로 가로·세로 둘 다 옮긴다.
    const box = room.getBoundingClientRect()
    const view = floor.getBoundingClientRect()
    floor.scrollTo({
      top: Math.max(0, box.top - view.top + floor.scrollTop - 16),
      left: Math.max(0, box.left - view.left + floor.scrollLeft - 16),
      behavior: "smooth",
    })
  }
  const side = (
    <>
      <section aria-labelledby="office-world-map" className="grid gap-1.5">
        <h3
          id="office-world-map"
          className="inline-flex w-fit items-center gap-1.5 bg-[#2b2a36] px-1.5 py-px text-xs text-[#f7f2e8]"
        >
          <PixelIcon name="flag" />
          {t("hud.worldMap")}
        </h3>
        <WorldMap
          offices={offices}
          homeProject={homeRepo}
          automations={snapshot.automations}
          onPick={showRoom}
        />
      </section>
      <MachineRoom automations={snapshot.automations} now={now} />
    </>
  )
  // 방금 레벨이 오른 세션
  const levelUps = new Set(
    levels
      .filter((entry) => now - Date.parse(entry.at) < LEVEL_UP_MS)
      .map((entry) => entry.key)
  )
  const totalTools = snapshot.agents.reduce(
    (sum, agent) => sum + agent.toolCount,
    0
  )

  return (
    <CatNamesContext value={names}>
      <div
        ref={areaRef}
        className="grid content-start gap-4 bg-background [&:fullscreen]:overflow-y-auto [&:fullscreen]:p-6"
      >
        <Hud>
          {/* 현황 칸은 좁으면 저희끼리 줄을 바꾸고, 버튼 셋은 늘 첫 줄 오른쪽에 함께 선다. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-3">
            <HudItem
              icon="clock"
              label=""
              value={gameClock(snapshot.generatedAt)}
            />
            {stale ? (
              <HudItem
                icon="warn"
                label={t("hud.refreshFailed")}
                value={t("hud.lastScreen")}
                tone="alert"
              />
            ) : null}
            {counts.needsYou ? (
              <HudItem
                icon="alert"
                label={t("hud.needsYou")}
                value={counts.needsYou}
                tone="alert"
              />
            ) : null}
            <HudItem
              icon="work"
              label={t("hud.busy")}
              value={counts.busy}
              tone={counts.busy ? "good" : "plain"}
            />
            <HudItem icon="wait" label={t("hud.waiting")} value={counts.waiting} />
            <HudItem icon="sleep" label={t("hud.resting")} value={counts.resting} />
            {counts.ended ? (
              <HudItem icon="house" label={t("hud.ended")} value={counts.ended} />
            ) : null}
            <HudItem icon="star" label={t("hud.today")}
              value={t("hud.toolCalls", { n: totalTools })} />
            <HudItem
              icon="gear"
              label={t("hud.automations")}
              value={snapshot.automations.length}
            />
          </div>
        </Hud>

        <OfficeStage
          scene={offices.length ? "building" : "empty"}
          tools={
            <>
              <OfficeCapture area={areaRef} />
              <button
                type="button"
                className={TOOL_BUTTON}
                onClick={toggleFull}
                aria-pressed={full}
              >
                {full ? t("hud.fullscreenOff") : t("hud.fullscreen")}
              </button>
            </>
          }
        >
          {offices.length ? (
            <Building
              name={buildingName}
              offices={offices}
              agents={working}
              now={now}
              levelUps={levelUps}
              side={side}
            />
          ) : (
            <div className="grid min-h-0 min-w-0 gap-4 overflow-y-auto">
              <EmptyOffice />
              <AutomationRoom automations={snapshot.automations} now={now} />
            </div>
          )}
        </OfficeStage>
      </div>
    </CatNamesContext>
  )
}
