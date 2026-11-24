// 그림에서 고양이 자세를 고르는 작은 판단들. 쉬는 활동별 자세, 누가 고개를
// 드는지(찾아온 고양이·일을 마친 동료), 지금 누가 산책 중인지를 정한다.
import { poseFor } from "@/office/office-draw"
import type { Walker } from "@/office/office-walk"
import type { CatPose } from "@/office/sprites"
import { idleActivity, recentMoment } from "@/lib/agent-office-acts"
import type { SessionAgent } from "@/lib/agent-office"

/** 쉬는 고양이는 졸 때만 엎드리고, 털 고르기는 앞발을 핥고, 창밖 구경은 창 쪽으로 돌아선다. */
export function idlePose(
  agent: SessionAgent,
  now: number,
  tower: boolean,
  mates: readonly SessionAgent[]
): CatPose {
  // 걷는 고양이는 걷는 자세로 그리므로, 여기 오는 산책 차례 고양이는 나서지 못한 것이다.
  const activity = idleActivity(agent, now, tower, mates, true)
  if (activity === "groom") return "groom"
  // 창밖 구경은 위쪽 벽(창) 쪽으로 돌아앉는다.
  if (activity === "window") return "gaze"
  return poseFor(agent.state)
}

/**
 * 고개를 드는 고양이들. 누가 찾아와 얘기하는 중이거나, 동료가 방금 일을
 * 마쳐(TeammateIdle) 부른 고양이다.
 */
export function perkedUp(
  walkers: Map<string, Walker>,
  seated: SessionAgent[],
  now: number
) {
  return new Set([
    ...[...walkers.values()]
      .filter((walker) => walker.visit?.stage === "stay")
      .map((walker) => walker.visit?.to),
    ...seated.flatMap((agent) => {
      const idle = recentMoment(agent, "TeammateIdle", now)
      return idle
        ? seated
            .filter((other) => other.peerName === idle.detail)
            .map((other) => other.key)
        : []
    }),
  ])
}

/**
 * 지금 산책 중인 고양이 key를 정렬해 줄바꿈으로 이은 값(바뀔 때만 대사를
 * 고친다). key 안에 |가 있어(claude|…) |로 이으면 다시 나눌 때 key가 쪼개진다.
 */
export function strollingKeys(walkers: Map<string, Walker>) {
  return [...walkers]
    .filter(
      ([, walker]) => walker.visit && !walker.visit.to && !walker.visit.long
    )
    .map(([key]) => key)
    .sort()
    .join("\n")
}
