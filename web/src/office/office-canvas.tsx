import { t } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import {
  CAT_HEAD,
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
} from "@/office/office-draw"
import { awayOnVisit, drawTalk, type Walker } from "@/office/office-walk"
import { SIT_OFFSET, seatPoint } from "@/office/walk-paths"
import { moveCat } from "@/office/cat-move"
import { coatFor, drawCat } from "@/office/sprites"
import { DeskOverlays } from "@/office/desk-overlays"
import { trips } from "@/office/visit-sync"
import {
  idlePose,
  perkedUp,
  meetingKeys,
  strollingKeys,
} from "@/office/office-moods"
import { usePixelLoop } from "@/office/use-pixel-loop"
import { type SessionAgent } from "@/lib/agent-office"
import { recentMoment } from "@/lib/agent-office-acts"
import { useTowerNearby } from "@/office/use-tower"

/**
 * 폴더 방 하나의 책상 구역. 넘겨받은 순서대로 앉는다. 책상 앞 이름표는
 * 캔버스 위에 둥근모꼴 글자로 얹는다(캔버스에 작은 한글을 그리면 번진다).
 */
// 책상 구역 둘레로 더 그리는 폭(캔버스 px). 걷는 고양이 몸 하나(16)보다 넉넉히.
const EDGE = 24

export function OfficeCanvas({
  label,
  agents,
  now,
  levelUps,
}: {
  label: string
  agents: SessionAgent[]
  now: number
  levelUps: Set<string>
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
  // 실제로 만나는 중인 쉬는 고양이들(대사와 말풍선 숨김이 따른다)
  const [meetings, setMeetings] = useState("")
  const meetingsRef = useRef("")
  const [hasTower, towerRef] = useTowerNearby(boxRef)

  const canvasRef = usePixelLoop(agents, (ctx, current, dt, t, still) => {
    const seated = current.slice(0, MAX_DESKS)
    const room = officeLayout(seated.length, fitCols)
    const walkers = walkersRef.current
    // 그림판은 사방으로 EDGE만큼 넓다. 책상 구역 가장자리를 지나는 고양이가
    // 잘리지 않게 그 둘레까지 그리고, 좌표는 책상 구역 기준 그대로 쓴다.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.translate(EDGE, EDGE)
    drawRoom(ctx, room)
    seated.forEach((_, index) => drawChair(ctx, room, index))
    // 고개를 드는 고양이(찾아온 고양이가 있거나 일을 마친 동료가 부름)
    const visited = perkedUp(walkers, seated, nowRef.current)
    seated.forEach((agent, index) => {
      const walker = moveCat(walkers, agent, index, {
        room,
        seated,
        t,
        now: nowRef.current,
        dt,
        still,
        nearby: towerRef.current,
      })
      const walking = walker.path.length > 0
      // 퇴근길을 다 걸어 문밖으로 나간 고양이는 그리지 않는다.
      const gone = Boolean(walker.out)
      // 대사 상자는 고양이를 따라다닌다(산책·찾아가기·캣타워). 퇴근한 고양이는 자리에 둔다.
      const speech = speechRefs.current.get(agent.key)
      // 휴게 공간에 나와 있으면 그 고양이(visit-cats.tsx)가 대사를 옮긴다.
      // 거기 그려지지 못한 고양이(캣타워 층이 모자람 등)는 대사를 자리에 둔다.
      const away = awayOnVisit(walker)
      if (speech && !(away && trips.get(agent.key)?.shown)) {
        // 머리 위: 발밑에서 앉은 높이(SIT_OFFSET)와 머리(CAT_HEAD)만큼 위
        const at = gone || away ? seatPoint(room, index) : walker
        const left = `${(at.x / room.w) * 100}%`
        const top = `${((at.y - SIT_OFFSET - CAT_HEAD) / room.h) * 100}%`
        if (speech.style.left !== left) speech.style.left = left
        if (speech.style.top !== top) speech.style.top = top
        // 자리를 떠나면 책상 이름표(z-40)에 가리지 않게 그 위로 올린다.
        const out = !gone && (walking || Boolean(walker.visit))
        const z = out ? "45" : ""
        if (speech.style.zIndex !== z) speech.style.zIndex = z
      }
      const tie = familyColor(agent.family)
      const coat = coatFor(agent.key)
      if (!gone && !away) {
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
            : // 쉬는 동료 곁에 같이 엎드려 잔다(쉬는 고양이끼리 만남).
              walker.visit?.nap
              ? "sleep"
              : visited.has(agent.key)
                ? "alert"
                : // 오류로 멈추면 X자 눈으로 고개를 숙인다(조는 고양이와 구분).
                  agent.trouble
                  ? "dizzy"
                  : idlePose(agent, nowRef.current, towerRef.current, seated),
          walking ? walker.dir : "front",
          t
        )
        const visit = walker.visit
        if (visit?.stage === "stay" && visit.to && !visit.nap)
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
    const meeting = meetingKeys(walkers)
    if (meeting !== meetingsRef.current) {
      meetingsRef.current = meeting
      setMeetings(meeting)
    }
    for (const key of walkers.keys()) {
      if (seated.some((agent) => agent.key === key)) continue
      walkers.delete(key)
      trips.delete(key)
    }
  })

  return (
    <div ref={boxRef} className="w-full min-w-0">
      <div
        className="relative max-w-full"
        style={{
          width: layout.w * OFFICE_SCALE,
          height: layout.h * OFFICE_SCALE,
        }}
      >
        <canvas
          ref={canvasRef}
          width={layout.w + EDGE * 2}
          height={layout.h + EDGE * 2}
          role="img"
          aria-label={t("room.deskDrawing", { name: label, n: agents.length })}
          className="pointer-events-none absolute max-w-none [image-rendering:pixelated]"
          style={{
            left: -EDGE * OFFICE_SCALE,
            top: -EDGE * OFFICE_SCALE,
            width: (layout.w + EDGE * 2) * OFFICE_SCALE,
            height: (layout.h + EDGE * 2) * OFFICE_SCALE,
          }}
        />
        <DeskOverlays
          agents={agents.slice(0, MAX_DESKS)}
          layout={layout}
          now={now}
          levelUps={levelUps}
          tower={hasTower}
          strollers={strollers}
          meetings={meetings}
          speechRefs={speechRefs}
        />
      </div>
    </div>
  )
}
