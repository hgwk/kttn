// 책상 구역 고양이 한 마리의 걸음을 한 장면만큼 정한다. 고양이의 길(path)과
// 나들이(visit)는 여기서만 바꾼다. 들어오기, 메시지 상대 찾아가기, 쉬는 시간의
// 산책·캣타워·소품 나들이, 배치가 바뀐 뒤 새 자리로 옮기기, 퇴근과 복귀를 한
// 차례로 판단하므로 두 갈래가 같은 장면에서 서로 길을 덮어쓰지 않는다.
import {
  advanceVisit,
  awayOnVisit,
  startIdleWalk,
  startVisit,
  step,
  type Walker,
} from "@/office/office-walk"
import { seatPoint, type OfficeLayout } from "@/lib/desk-layout"
import { loungeExit } from "@/lib/desk-walk"
import { route, settle, type Grid, type Point } from "@/lib/walk-grid"
import { type SessionAgent } from "@/lib/agent-office"
import {
  IDLE_SLOT_MS,
  MINGLE_STAY_MS,
  STROLL_START_MS,
  idleActivity,
  mingle,
  visitingName,
  type Nearby,
} from "@/lib/agent-office-acts"

// 쉬는 고양이끼리 만나러 나서는 때. 1분의 처음 이만큼(ms) 안에만 나선다.
const MINGLE_START_MS = 8_000

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
  /** 이 배치의 걷는 격자(배치가 바뀔 때만 새로 만든다) */
  grid: Grid
  /** 배치를 나타내는 글자(구역 크기, 자리 순서, 자유 자리). 바뀌면 길을 다시 찾는다. */
  plan: string
}

/**
 * 지금 선 곳에서 to까지의 길. 길이 없으면(막힌 곳에 갇힘) 그 자리로 옮겨 놓고
 * 빈 길을 돌려준다. 같은 길을 장면마다 다시 찾지 않게 한다.
 */
function goTo(walker: Walker, grid: Grid, to: Point) {
  const path = route(grid, walker, to)
  if (!path.length) Object.assign(walker, to)
  return path
}

/** 처음 보는 세션의 고양이. 새로 연 세션만 문에서 걸어 들어온다. */
function arrive(
  agent: SessionAgent,
  room: OfficeLayout,
  grid: Grid,
  index: number
) {
  // 시작 직후 지침 파일 읽기(InstructionsLoaded)가 순간(moment)을 덮으므로
  // 시작 방식은 따로 남긴 값(startedAs)으로 본다. 이어서 연 세션(resume·
  // clear·compact)은 자리에서 깨어난다.
  const resumed = agent.startedAs !== "" && agent.startedAs !== "startup"
  const arriving =
    !resumed && (agent.state === "idle" || agent.state === "thinking")
  const seat = seatPoint(room, index)
  return arriving
    ? { ...room.door, path: route(grid, room.door, seat), dir: "front" as const }
    : { ...seat, path: [], dir: "front" as const }
}

/** 퇴근한 세션은 하던 나들이를 접고 지금 선 곳에서 문으로 걸어 나간다. */
function leave(walker: Walker, room: OfficeLayout, grid: Grid) {
  if (walker.leaving || walker.out) return
  const visit = walker.visit
  // 캣타워·소품에 가 있으면 먼저 돌아 나오게 둔다(advanceVisit이 되돌린다).
  if (visit?.kind && visit.stage !== "back") return
  walker.visit = undefined
  walker.path = goTo(walker, grid, room.door)
  walker.leaving = true
}

/** 앉아 있다가 걸으러 나설 차례인지 보고 길을 정한다. */
function setOff(
  walker: Walker,
  agent: SessionAgent,
  index: number,
  frame: MoveFrame
) {
  const { room, seated, t, now, grid } = frame
  const talkTo = visitingName(agent, now)
  if (talkTo && walker.played !== agent.visitAt) {
    walker.played = agent.visitAt
    const target = seated.findIndex(
      (other) => other.key !== agent.key && other.peerName === talkTo
    )
    if (target >= 0) startVisit(walker, { layout: room, grid }, target, seated[target].key)
    return
  }
  const slot = Math.floor(t / IDLE_SLOT_MS)
  const late = t - slot * IDLE_SLOT_MS > STROLL_START_MS
  // 쉬는 고양이끼리 만나는 차례면(대사와 같은 계산) 찾아가는 쪽은 1분
  // 첫머리에 상대 책상 옆으로 가고, 맞는 쪽은 자리를 지킨다.
  // 다녀온 뒤나 나설 때(8초)를 놓쳤으면 그 시간이 끝날 때까지 자리에 있는다.
  const meet = mingle(agent, t, seated)
  if (meet) {
    const host = seated.findIndex((other) => other.key === meet.other)
    const fresh = t - slot * IDLE_SLOT_MS < MINGLE_START_MS
    if (meet.role === "visitor" && host >= 0 && fresh) {
      if (walker.strolled === slot) return
      walker.strolled = slot
      startVisit(walker, { layout: room, grid }, host, meet.other, {
        stayMs: MINGLE_STAY_MS,
        nap: meet.nap,
      })
    }
    return
  }
  // 대사(cat-speech)와 같은 판단: 산책을 다녀왔거나 나설 때를 놓쳤으면
  // 산책 대신 남은 시간에 하는 일을 고른다.
  const walkedOff = walker.strolled === slot || late
  startIdleWalk(
    walker,
    idleActivity(agent, t, frame.nearby, seated, walkedOff),
    slot,
    { layout: room, grid, index },
    IDLE_SLOT_MS,
    STROLL_START_MS,
    t
  )
}

/**
 * 배치가 바뀌면(세션이 늘거나 줄거나, 창 폭이 바뀌거나, 자유 자리가 바뀜) 옛
 * 좌표의 길을 버리고 지금 선 곳에서 다시 찾는다. 새 구역 밖이나 가구 안에
 * 서 있으면 가장 가까운 걸을 수 있는 칸으로 먼저 옮긴다.
 */
function replan(walker: Walker, room: OfficeLayout, grid: Grid, index: number) {
  const visit = walker.visit
  const seat = seatPoint(room, index)
  if (walker.out) return
  // 휴게 공간에 가 있는 고양이는 새 휴게 공간 입구에서 돌아온다.
  if (awayOnVisit(walker)) {
    Object.assign(walker, loungeExit(room, index))
    return
  }
  Object.assign(walker, settle(grid, walker))
  if (walker.leaving) walker.path = goTo(walker, grid, room.door)
  else if (visit?.kind && visit.stage === "go")
    walker.path = goTo(walker, grid, loungeExit(room, index))
  else if (visit) {
    // 산책이나 찾아가기는 접고 새 자리로 돌아간다.
    visit.stage = "back"
    walker.path = goTo(walker, grid, seat)
  } else if (walker.path.length) walker.path = goTo(walker, grid, seat)
}

/** 고양이 한 마리를 한 장면만큼 움직인다. 없으면 만들어 walkers에 넣는다. */
export function moveCat(
  walkers: Map<string, Walker>,
  agent: SessionAgent,
  index: number,
  frame: MoveFrame
) {
  const { room, seated, t, still, grid } = frame
  let walker = walkers.get(agent.key)
  if (!walker) {
    walker = arrive(agent, room, grid, index)
    walker.plan = frame.plan
    walkers.set(agent.key, walker)
  }
  if (still) {
    // 줄임 동작이면 걷지 않고 늘 자리에 앉아 있다.
    Object.assign(walker, seatPoint(room, index), { path: [], dir: "front" })
    walker.visit = undefined
    walker.leaving = false
    walker.out = agent.state === "ended"
    walker.plan = frame.plan
    return walker
  }
  if (walker.plan !== frame.plan) {
    walker.plan = frame.plan
    replan(walker, room, grid, index)
  }
  if (agent.state === "ended") leave(walker, room, grid)
  else rejoin(walker, room, grid, index)
  const free = !walker.visit && !walker.path.length && !walker.out
  if (free && agent.state !== "ended") {
    const seat = seatPoint(room, index)
    // 자리에 있지 않으면(배치가 바뀌어 자리가 옮겨짐) 걸어서 자리로 간다.
    if (Math.hypot(walker.x - seat.x, walker.y - seat.y) > 0.5)
      walker.path = goTo(walker, grid, seat)
    else setOff(walker, agent, index, frame)
  }
  // 쉬는 동료와의 만남(stayMs)은 둘 중 하나라도 깨면 끝내고 돌아온다.
  const meeting = Boolean(walker.visit?.stayMs)
  const awake = meeting && agent.state !== "sleeping"
  const home = () => goTo(walker, grid, seatPoint(room, index))
  advanceVisit(
    walker,
    t,
    (key) =>
      !awake &&
      seated.some(
        (other) =>
          other.key === key && (!meeting || other.state === "sleeping")
      ),
    agent,
    home
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
function rejoin(
  walker: Walker,
  layout: OfficeLayout,
  grid: Grid,
  index: number
) {
  if (!walker.out && !walker.leaving) return
  if (walker.out) Object.assign(walker, layout.door)
  walker.path = goTo(walker, grid, seatPoint(layout, index))
  walker.out = false
  walker.leaving = false
}
