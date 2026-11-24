// 책상 구역 그림판(office-canvas.tsx)과 휴게 공간 소품 곁 고양이(visit-cats.tsx)가
// 한 고양이의 소품 나들이를 이어 그리도록 맞추는 자리. 그림판 고양이가 책상 구역
// 아래 끝에 닿아 사라진 시각(arrived)부터 소품 곁 고양이가 걸어 들어오고, 돌아갈
// 시각(until) 전에 걸어 나간다. 걸어 나가는 데 드는 시간(outMs)은 소품 곁
// 고양이가 화면에서 재어 적는다. 소품 곁 고양이가 있었는지는 prop으로 남긴다.

type Trip = { arrived: number; until: number; outMs: number; prop?: boolean }

export const trips = new Map<string, Trip>()

type LongVisit = { stage: "go" | "stay" | "back"; until: number }

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
  if (visit.stage === "back") {
    trips.delete(key)
    return false
  }
  if (visit.stage === "go") return !resting
  let trip = trips.get(key)
  if (!trip || trip.arrived > t || trip.until < t - 1000) {
    trip = { arrived: t, until: visit.until, outMs: 0 }
    trips.set(key, trip)
  }
  if (!resting) visit.until = Math.min(visit.until, t + trip.outMs)
  trip.until = visit.until
  return false
}
