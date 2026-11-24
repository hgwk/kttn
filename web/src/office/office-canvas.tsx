import { t } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import {
  CAT_DX,
  MAX_DESKS,
  OFFICE_SCALE,
  drawChair,
  drawDesk,
  drawMinions,
  drawRoom,
  drawCheck,
  drawSmoke,
  familyColor,
  colsForWidth,
  officeLayout,
  seatFor,
} from "@/office/office-draw"
import {
  drawTalk,
  outsideY,
  pathToDoor,
  pathToSeat,
  advanceVisit,
  startIdleWalk,
  startVisit,
  seatPoint,
  step,
  type DoorSide,
  type Walker,
} from "@/office/office-walk"
import { coatFor, drawCat } from "@/office/sprites"
import { DeskOverlays } from "@/office/desk-overlays"
import {
  idlePose,
  perkedUp,
  strollingKeys,
} from "@/office/office-moods"
import { usePixelLoop } from "@/office/use-pixel-loop"
import { type SessionAgent } from "@/lib/agent-office"
import {
  IDLE_SLOT_MS,
  STROLL_START_MS,
  idleActivity,
  recentMoment,
  visitingName,
} from "@/lib/agent-office-acts"

/**
 * 폴더 방 하나의 책상 구역. 넘겨받은 순서대로 앉는다. 책상 앞 이름표는
 * 캔버스 위에 둥근모꼴 글자로 얹는다(캔버스에 작은 한글을 그리면 번진다).
 */
export function OfficeCanvas({
  label,
  agents,
  now,
  levelUps,
  door = "bottom",
}: {
  label: string
  agents: SessionAgent[]
  now: number
  levelUps: Set<string>
  door?: DoorSide
}) {
  const walkersRef = useRef(new Map<string, Walker>())
  // 방 안쪽 너비에 맞춰 책상 열 수를 고른다. 처음(서버 그림)은 기본 배치다.
  const boxRef = useRef<HTMLDivElement>(null)
  const [fitCols, setFitCols] = useState<number>()
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) =>
      setFitCols(colsForWidth(entry.contentRect.width))
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const layout = officeLayout(agents.length, fitCols)
  // 같은 책상 구역의 휴게 공간에 캣타워가 놓였는지. 휴게 공간은 들어갈
  // 자리가 있을 때만 그려지므로 화면에서 확인한다.
  // 대사 상자와 같은 시계(마지막으로 받은 현황 시각)로 쉬는 활동·순간을
  // 고른다. 화면 시계를 따로 쓰면 1분이 바뀔 때 대사와 걸음이 잠깐 어긋난다.
  const nowRef = useRef(now)
  useEffect(() => {
    nowRef.current = now
  }, [now])
  // 그림에서 지금 산책 중인 고양이(대사가 걸음과 맞게 바뀐다). 바뀔 때만 고친다.
  // 고양이별 대사 상자. 그리는 고리에서 고양이 자리로 옮긴다.
  const speechRefs = useRef(new Map<string, HTMLDivElement>())
  const [strollers, setStrollers] = useState("")
  const strollersRef = useRef("")
  const [hasTower, setHasTower] = useState(false)
  const towerRef = useRef(false)
  useEffect(() => {
    const check = () => {
      const found = Boolean(
        boxRef.current?.parentElement?.querySelector("[data-cat-tower]")
      )
      towerRef.current = found
      setHasTower(found)
    }
    check()
    const timer = window.setInterval(check, 2000)
    return () => window.clearInterval(timer)
  }, [])

  const canvasRef = usePixelLoop(agents, (ctx, current, dt, t, still) => {
    const seated = current.slice(0, MAX_DESKS)
    const room = officeLayout(seated.length, fitCols)
    const walkers = walkersRef.current
    // 퇴근길을 다 걸어 문밖으로 나간 고양이만 방 밖으로 친다. 높이로 가리면
    // 배치가 바뀌어 방이 낮아질 때 아랫줄 고양이가 밖으로 몰려 사라진다.
    const inside = (walker: Walker) => !walker.out
    drawRoom(ctx, room)
    seated.forEach((_, index) => drawChair(ctx, room, index))
    // 고개를 드는 고양이(찾아온 고양이가 있거나 일을 마친 동료가 부름)
    const visited = perkedUp(walkers, seated, nowRef.current)
    seated.forEach((agent, index) => {
      const seat = seatPoint(room, index)
      let walker = walkers.get(agent.key)
      if (!walker) {
        // 이미 앉아 있던 세션은 처음 그릴 때 바로 자리에 둔다. 이어서 연
        // 세션(resume·clear·compact)도 자리에서 깨어나고, 새로 연 세션만
        // 문에서 걸어 들어온다.
        // 시작 직후 지침 파일 읽기(InstructionsLoaded)가 순간(moment)을 덮으므로
        // 시작 방식은 따로 남긴 값(startedAs)으로 본다.
        const resumed = agent.startedAs !== "" && agent.startedAs !== "startup"
        const arriving =
          !resumed && (agent.state === "idle" || agent.state === "thinking")
        walker = arriving
          ? {
              x: room.door.x,
              y: outsideY(room, door),
              path: pathToSeat(room, index),
              dir: door === "top" ? "front" : "back",
            }
          : { ...seat, path: [], dir: "front" }
        walkers.set(agent.key, walker)
      }
      // 걸으러 나갈 수 있는 고양이(앉아 있고, 걷거나 찾아가는 중이 아님)는
      // 메시지 보낸 상대에게 가서 얘기하거나(같은 방에 있을 때, 메시지마다
      // 한 번), 오래 쉬면 산책·캣타워 차례에 걸어 나갔다 온다.
      if (
        !walker.visit &&
        walker.path.length === 0 &&
        inside(walker) &&
        !still
      ) {
        const talkTo = visitingName(agent, nowRef.current)
        if (talkTo && walker.played !== agent.visitAt) {
          walker.played = agent.visitAt
          const target = seated.findIndex(
            (other) => other.key !== agent.key && other.peerName === talkTo
          )
          if (target >= 0)
            startVisit(walker, room, index, target, seated[target].key)
        } else {
          startIdleWalk(
            walker,
            idleActivity(agent, nowRef.current, towerRef.current, seated),
            Math.floor(nowRef.current / IDLE_SLOT_MS),
            room,
            index,
            IDLE_SLOT_MS,
            STROLL_START_MS,
            nowRef.current
          )
        }
      }
      advanceVisit(walker, t, (key) =>
        seated.some((other) => other.key === key)
      )
      // 자리가 바뀌면(세션이 늘거나 줄어 배치가 바뀐 경우) 앉은 고양이는 새 자리로 옮긴다.
      if (!walker.visit && walker.path.length === 0 && inside(walker)) {
        walker.x = seat.x
        walker.y = seat.y
        walker.dir = "front"
      }
      if (agent.state === "ended" && walker.path.length === 0) {
        if (inside(walker)) {
          walker.path = pathToDoor(room, index, door)
          walker.leaving = true
        }
      }
      // 퇴근했다가 다시 돌아온 세션은 자리에 앉힌다.
      if (agent.state !== "ended" && walker.out) {
        walker.out = false
        walker.leaving = false
      }
      if (still) {
        walker.path.length = 0
        walker.visit = undefined
      }
      step(walker, dt)
      if (walker.leaving && walker.path.length === 0) {
        walker.leaving = false
        walker.out = true
      }

      const walking = walker.path.length > 0
      const gone = agent.state === "ended" && !walking
      // 대사 상자는 고양이를 따라다닌다(산책·찾아가기·캣타워). 퇴근한 고양이는 자리에 둔다.
      const speech = speechRefs.current.get(agent.key)
      if (speech) {
        // 문으로 들고 나는 고양이는 그림 밖에 있어 안 보이므로, 그동안은 대사를
        // 자리 위에 둔다(빈 바닥에 상자만 떠 있지 않게).
        const outside =
          walker.x < 0 ||
          walker.x > room.w ||
          walker.y < 14 ||
          walker.y > room.h
        const at = gone || outside ? seatFor(room, index) : walker
        const left = `${((at.x + CAT_DX) / room.w) * 100}%`
        const top = `${((at.y - 14) / room.h) * 100}%`
        if (speech.style.left !== left) speech.style.left = left
        if (speech.style.top !== top) speech.style.top = top
        // 자리를 떠나면 책상 이름표(z-40)에 가리지 않게 그 위로 올린다.
        const away = !gone && (walking || Boolean(walker.visit))
        const z = away ? "45" : ""
        if (speech.style.zIndex !== z) speech.style.zIndex = z
      }
      const tie = familyColor(agent.family)
      const coat = coatFor(agent.key)
      if (!gone) {
        const hop =
          agent.state === "needs_you" && !walking
            ? Math.abs(Math.round(Math.sin(t / 160) * 2))
            : 0
        drawCat(
          ctx,
          walker.x,
          walker.y - hop,
          coat,
          tie,
          walking
            ? "walk"
            : visited.has(agent.key)
              ? "alert"
              : // 오류로 멈추면 X자 눈으로 고개를 숙인다(조는 고양이와 구분).
                agent.trouble
                ? "dizzy"
                : idlePose(agent, nowRef.current, towerRef.current, seated),
          walking ? walker.dir : "front",
          t
        )
        if (walker.visit?.stage === "stay" && walker.visit.to)
          drawTalk(ctx, walker.x, walker.y, t)
        if (recentMoment(agent, "PostToolUseFailure", nowRef.current))
          drawSmoke(ctx, walker.x, walker.y, t)
        if (recentMoment(agent, "TaskCompleted", nowRef.current))
          drawCheck(ctx, walker.x, walker.y)
      }
      drawDesk(ctx, room, index, gone ? null : agent.state, t)
      if (!walking && !gone && !walker.visit) {
        if (agent.minions.length)
          drawMinions(ctx, room, index, agent.minions.length, tie, agent.key, t)
      }
    })
    const strolling = strollingKeys(walkers)
    if (strolling !== strollersRef.current) {
      strollersRef.current = strolling
      setStrollers(strolling)
    }
    for (const key of walkers.keys()) {
      if (!seated.some((agent) => agent.key === key)) walkers.delete(key)
    }
  })

  return (
    <div ref={boxRef} className="w-full min-w-0">
      <div
        className="relative max-w-full"
        style={{ width: layout.w * OFFICE_SCALE }}
      >
        <canvas
          ref={canvasRef}
          width={layout.w}
          height={layout.h}
          role="img"
          aria-label={t("room.deskDrawing", { name: label, n: agents.length })}
          className="block h-auto w-full [image-rendering:pixelated]"
        />
        <DeskOverlays
          agents={agents.slice(0, MAX_DESKS)}
          layout={layout}
          now={now}
          levelUps={levelUps}
          tower={hasTower}
          strollers={strollers}
          speechRefs={speechRefs}
        />
      </div>
    </div>
  )
}
