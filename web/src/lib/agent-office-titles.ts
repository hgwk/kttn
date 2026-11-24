// 고양이 칭호. 도감 기록(누적 도구 수, 처음 본 날, 새벽 근무)과 지금 도구 수로
// 정한다. 이름표에는 가장 높은 칭호 하나를, 도감 카드에는 전부를 단다. 화면
// 글자는 사전의 title.<id>에 있다.

export type TitleId = "legend" | "veteran" | "nightOwl" | "oldHand" | "worker"

/** 높은 것부터. 이름표에는 이 순서로 처음 해당하는 칭호 하나를 단다. */
export const TITLE_ORDER: TitleId[] = [
  "legend",
  "veteran",
  "nightOwl",
  "oldHand",
  "worker",
]

const DAY_MS = 86_400_000

export type TitleInput = {
  /** 누적 도구 수(지금 값과 도감 값 가운데 큰 것) */
  tools: number
  /** 처음 본 시각(ISO). 모르면 빈 문자열 */
  firstSeen?: string
  /** 새벽(0~5시)에 일한 적이 있는지 */
  nightOwl?: boolean
}

/** 해당하는 칭호들(높은 것부터) */
export function titlesFor(input: TitleInput, now: number): TitleId[] {
  const first = input.firstSeen ? Date.parse(input.firstSeen) : NaN
  const has: Record<TitleId, boolean> = {
    legend: input.tools >= 1000,
    veteran: input.tools >= 500,
    nightOwl: Boolean(input.nightOwl),
    oldHand: !Number.isNaN(first) && now - first >= 7 * DAY_MS,
    worker: input.tools >= 100,
  }
  const titles = TITLE_ORDER.filter((id) => has[id])
  // 위 칭호가 있으면 같은 줄기의 아래 칭호는 뺀다(전설이면 베테랑, 일꾼 생략).
  return titles.filter(
    (id) =>
      !(id === "veteran" && has.legend) &&
      !(id === "worker" && (has.legend || has.veteran))
  )
}
