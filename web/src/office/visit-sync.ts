// 책상 구역 그림판(cat-move.ts)과 휴게 공간의 고양이(visit-cats.tsx)가 한
// 고양이의 캣타워·소품 나들이를 이어 그리도록 맞추는 자리. 쓰는 쪽은 그림판
// 하나뿐이고(arrived, until), 휴게 공간 쪽은 걸어 나가는 데 드는 시간(outMs)과
// 그렸는지(shown)만 적는다. 그림판 고양이가 책상 구역 아래 끝에 닿아 사라진
// 시각(arrived)부터 휴게 공간 고양이가 걸어 들어오고, 돌아갈 시각(until) 전에
// 걸어 나간다.

export type Trip = {
  kind: "tower" | "prop"
  arrived: number
  until: number
  outMs: number
  shown?: boolean
}

export const trips = new Map<string, Trip>()

type LongVisit = {
  stage: "go" | "stay" | "back"
  until: number
  kind?: "tower" | "prop"
}

/**
 * 캣타워나 소품에 가는 동안 매 장면 부른다. 깨면(resting false) 걸어 나갈
 * 시간만 두고 돌아올 시각을 당긴다. 가는 길에 깨면 true를 돌려 바로 돌아선다.
 */
export function holdTrip(
  key: string,
  visit: LongVisit,
  t: number,
  resting: boolean
) {
  if (visit.stage === "back" || !visit.kind) {
    trips.delete(key)
    return false
  }
  if (visit.stage === "go") return !resting
  let trip = trips.get(key)
  if (!trip || trip.arrived > t || trip.until < t - 1000) {
    trip = { kind: visit.kind, arrived: t, until: visit.until, outMs: 0 }
    trips.set(key, trip)
  }
  if (!resting) visit.until = Math.min(visit.until, t + trip.outMs)
  trip.until = visit.until
  return false
}
