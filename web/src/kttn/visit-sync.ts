// 책상 구역 그림판(cat-move.ts)과 휴게 공간의 고양이(visit-cats.tsx)가 한
// 고양이의 캣타워·소품 나들이를 이어 그리도록 맞추는 자리. 나들이 기록은
// 그림판이 만들고(arrived, until), 휴게 공간 쪽은 걸어 나가는 데 드는
// 시간(outMs), 그렸는지(shown), 고른 소품(spot)과 캣타워 층(perch)을 적고,
// 돌아갈 시각(until)은 당기기만 한다(깼거나 갈 소품이 없어졌을 때). 그림판이
// 화면 밖이라 멈춰 있어도 휴게 공간 쪽이 고양이를 돌려보낼 수 있다.
//   그림판 고양이가 책상 구역 아래 끝에 닿아 사라진 시각(arrived)부터 휴게
// 공간 고양이가 걸어 들어오고, 돌아갈 시각(until) 전에 걸어 나간다.
import { propPick } from "@/lib/kttn-acts"

export type Trip = {
  kind: "tower" | "prop"
  arrived: number
  until: number
  outMs: number
  shown?: boolean
  /** 찾아간 소품. 나들이 동안 다른 소품이 들고 나도 바뀌지 않게 요소를 둔다. */
  spot?: HTMLElement
  /** 올라앉은 캣타워와 그 층 */
  tower?: HTMLElement
  perch?: number
  /** 이 기록을 만든 나들이. 같은 나들이면 기록을 이어 쓴다. */
  of: object
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
  // 같은 나들이면 기록을 이어 쓴다(그림판이 멈췄던 사이 당겨 둔 until도 그대로).
  let trip = trips.get(key)
  if (trip?.of !== visit) {
    trip = {
      kind: visit.kind,
      arrived: t,
      until: visit.until,
      outMs: 0,
      of: visit,
    }
    trips.set(key, trip)
  }
  if (!resting) visit.until = Math.min(visit.until, t + trip.outMs)
  // 휴게 공간 쪽이 당긴 시각도 따른다.
  visit.until = Math.min(visit.until, trip.until)
  trip.until = visit.until
  return false
}

/** 휴게 공간 쪽에서 돌아갈 시각을 당긴다(지금부터 걸어 나갈 시간 뒤). */
export function cutTrip(trip: Trip, t: number) {
  trip.until = Math.min(trip.until, t + trip.outMs)
}

/**
 * 소품을 찾아간 고양이가 고른 소품(spots 가운데). 나들이 중이면 처음 고른
 * 소품을, 아니면 지금 시각으로 고른다. 대사와 그림이 같은 값을 쓴다. 고른
 * 소품이 치워졌으면 없다(undefined).
 */
export function spotFor(key: string, now: number, spots: HTMLElement[]) {
  const trip = trips.get(key)
  if (trip?.kind !== "prop") return spots[propPick(key, now, spots.length)]
  trip.spot ??= spots[propPick(key, trip.arrived, spots.length)]
  return trip.spot && spots.includes(trip.spot) ? trip.spot : undefined
}

/**
 * 캣타워(tower)에 올라간 고양이의 층. 같은 캣타워에서 다른 고양이가 쓰지
 * 않는 가장 낮은 번호다.
 */
export function perchFor(key: string, now: number, tower?: HTMLElement) {
  const trip = trips.get(key)
  if (trip?.kind !== "tower") return 0
  trip.tower ??= tower
  if (trip.perch === undefined) {
    const used = new Set(
      [...trips.values()]
        .filter((other) => other !== trip && other.tower === trip.tower)
        .filter((other) => other.kind === "tower" && other.until > now)
        .map((other) => other.perch)
    )
    let perch = 0
    while (used.has(perch)) perch++
    trip.perch = perch
  }
  return trip.perch
}
