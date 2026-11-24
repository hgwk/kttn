// 책상 구역 고양이 한 마리의 걸음을 한 장면만큼 정한다. 고양이의 길(path)과
// 나들이(visit)는 여기서만 바꾼다. 들어오기, 메시지 상대 찾아가기, 쉬는 시간의
// 산책·캣타워·소품 나들이, 배치가 바뀐 뒤 새 자리로 옮기기, 퇴근과 복귀를 한
// 차례로 판단하므로 두 갈래가 같은 장면에서 서로 길을 덮어쓰지 않는다.
import type { OfficeLayout } from "@/office/office-draw"
import {
  advanceVisit,
  startIdleWalk,
  startVisit,
  step,
  type Walker,
} from "@/office/office-walk"
import {
  pathOut,
  pathToDoor,
  pathToNewSeat,
  pathToSeat,
  seatPoint,
} from "@/office/walk-paths"
import { type SessionAgent } from "@/lib/agent-office"
import {
  IDLE_SLOT_MS,
  STROLL_START_MS,
  idleActivity,
  visitingName,
  type Nearby,
} from "@/lib/agent-office-acts"

export type MoveFrame = {
  room: OfficeLayout
  seated: SessionAgent[]
  /** 그림 시계(Date.now). 줄임 동작(still)이면 0. */
  t: number
  /** 마지막으로 받은 현황 시각. 메시지 찾아가기에 쓴다. */
  now: number
  dt: number
  still: boolean
  nearby: Nearby
}

/** 처음 보는 세션의 고양이. 새로 연 세션만 문에서 걸어 들어온다. */
function arrive(agent: SessionAgent, room: OfficeLayout, index: number) {
  // 시작 직후 지침 파일 읽기(InstructionsLoaded)가 순간(moment)을 덮으므로
  // 시작 방식은 따로 남긴 값(startedAs)으로 본다. 이어서 연 세션(resume·
  // clear·compact)은 자리에서 깨어난다.
  const resumed = agent.startedAs !== "" && agent.startedAs !== "startup"
  const arriving =
    !resumed && (agent.state === "idle" || agent.state === "thinking")
  const seat = seatPoint(room, index)
  return arriving
    ? { ...room.door, path: pathToSeat(room, index), dir: "front" as const }
    : { ...seat, path: [], dir: "front" as const }
}

/** 퇴근한 세션은 하던 나들이를 접고 통로를 따라 문으로 나간다. */
function leave(walker: Walker, room: OfficeLayout, index: number) {
  if (walker.leaving || walker.out) return
  const visit = walker.visit
  if (!visit) {
    // 자리를 옮기는 중이면 앉은 뒤에 나선다.
    if (walker.path.length) return
    walker.path = pathToDoor(room, index)
  } else {
    // 캣타워·소품에 가 있으면 먼저 돌아 나오게 둔다(advanceVisit이 되돌린다).
    if (visit.kind && visit.stage !== "back") return
    walker.path = pathOut(visit.lane, room)
    walker.visit = undefined
  }
  walker.leaving = true
}

/** 앉아 있다가 걸으러 나설 차례인지 보고 길을 정한다. */
function setOff(
  walker: Walker,
  agent: SessionAgent,
  index: number,
  frame: MoveFrame
) {
  const { room, seated, t, now } = frame
  const talkTo = visitingName(agent, now)
  if (talkTo && walker.played !== agent.visitAt) {
    walker.played = agent.visitAt
    const target = seated.findIndex(
      (other) => other.key !== agent.key && other.peerName === talkTo
    )
    if (target >= 0) startVisit(walker, room, index, target, seated[target].key)
    return
  }
  // 대사(cat-speech)와 같은 판단: 산책을 다녀왔거나 나설 때를 놓쳤으면
  // 산책 대신 남은 시간에 하는 일을 고른다.
  const slot = Math.floor(t / IDLE_SLOT_MS)
  const late = t - slot * IDLE_SLOT_MS > STROLL_START_MS
  const walkedOff = walker.strolled === slot || late
  startIdleWalk(
    walker,
    idleActivity(agent, t, frame.nearby, seated, walkedOff),
    slot,
    room,
    index,
    IDLE_SLOT_MS,
    STROLL_START_MS,
    t
  )
}

/** 고양이 한 마리를 한 장면만큼 움직인다. 없으면 만들어 walkers에 넣는다. */
export function moveCat(
  walkers: Map<string, Walker>,
  agent: SessionAgent,
  index: number,
  frame: MoveFrame
) {
  const { room, seated, t, still } = frame
  let walker = walkers.get(agent.key)
  if (!walker) {
    walker = arrive(agent, room, index)
    walkers.set(agent.key, walker)
  }
  if (still) {
    // 줄임 동작이면 걷지 않고 늘 자리에 앉아 있다.
    Object.assign(walker, seatPoint(room, index), { path: [], dir: "front" })
    walker.visit = undefined
    walker.leaving = false
    walker.out = agent.state === "ended"
    return walker
  }
  if (agent.state === "ended") leave(walker, room, index)
  else rejoin(walker, room, index)
  const free = !walker.visit && !walker.path.length && !walker.out
  if (free && agent.state !== "ended") {
    const seat = seatPoint(room, index)
    // 배치가 바뀌어 자리가 옮겨졌으면 걸어서 새 자리로 간다.
    if (Math.hypot(walker.x - seat.x, walker.y - seat.y) > 0.5)
      walker.path = pathToNewSeat(walker, room, index)
    else setOff(walker, agent, index, frame)
  }
  advanceVisit(
    walker,
    t,
    (key) => seated.some((other) => other.key === key),
    agent
  )
  step(walker, frame.dt)
  if (walker.leaving && walker.path.length === 0) {
    walker.leaving = false
    walker.out = true
  }
  return walker
}

/**
 * 퇴근길에 나섰거나 문밖으로 나간 세션이 다시 살아나면 문(또는 지금 선 곳)에서
 * 걸어 들어와 앉는다. 자리로 곧장 옮기면 사라졌던 고양이가 책상에 툭 나타난다.
 */
function rejoin(walker: Walker, layout: OfficeLayout, index: number) {
  if (!walker.out && !walker.leaving) return
  const path = pathToSeat(layout, index)
  if (walker.out) {
    walker.x = layout.door.x
    walker.y = layout.door.y
  }
  // 문 쪽 샛길에 있으면 통로까지 먼저 걷고, 아니면 통로부터 되짚어 온다.
  const atDoor = walker.out || Math.abs(walker.x - layout.door.x) < 1
  walker.path = atDoor ? path : path.slice(1)
  walker.out = false
  walker.leaving = false
}
