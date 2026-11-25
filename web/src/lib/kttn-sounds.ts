// 효과음을 낼 때. 직전 현황과 지금 현황을 비교해, 일을 마친 고양이(done),
// 확인을 기다리는 고양이(needs_you), 레벨이 오른 고양이를 찾는다. 소리는
// kttn/kttn-sounds.tsx가 낸다.

export type SoundCue = "done" | "needsYou" | "levelUp"

/**
 * prev는 직전 현황의 세션별 상태(처음이면 null: 화면을 연 순간 이미 그 상태인
 * 세션으로 소리를 내지 않는다), levelKeys는 이번에 레벨이 오른 세션들.
 * 같은 종류는 한 번만 낸다.
 */
export function soundCues(
  prev: Map<string, string> | null,
  next: readonly { key: string; state: string }[],
  levelKeys: readonly string[] = []
): SoundCue[] {
  if (!prev) return []
  const cues = new Set<SoundCue>()
  for (const agent of next) {
    const before = prev.get(agent.key)
    if (before === undefined || before === agent.state) continue
    if (agent.state === "needs_you") cues.add("needsYou")
    else if (agent.state === "done") cues.add("done")
  }
  if (levelKeys.length) cues.add("levelUp")
  // 급한 것부터 낸다.
  return (["needsYou", "levelUp", "done"] as const).filter((cue) =>
    cues.has(cue)
  )
}
