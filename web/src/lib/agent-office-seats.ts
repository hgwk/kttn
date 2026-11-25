// 고양이마다 앉는 자리 종류. 책상만이 아니라 바닥 방석, 빈백, 소파, 창턱 같은
// 자유 자리에서도 일한다. 종류는 고양이 key로 정하므로 새로 고쳐도 같은 자리다.
// 그림(sprite-art/seats.ts)이 있는 자리만 고르고, 없으면 모두 책상에 앉는다.

/** 자유 자리 그림의 칸 이름 */
export type SeatFrame = "work0" | "work1" | "idle" | "alert" | "rest" | "empty"

/** 책상에 앉는 몫. 나머지는 자유 자리를 고르게 나눠 갖는다. */
const DESK_SHARE = 0.5

// 털색(coatFor)과 다른 해시를 써서 털색과 자리가 같이 묶이지 않게 한다.
function seatHash(key: string) {
  let hash = 2166136261
  for (const char of `${key}:seat`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

/** 이 고양이의 자유 자리 이름. 책상에 앉으면 null이다. */
export function seatKindFor(key: string, names: readonly string[]) {
  if (!names.length) return null
  const roll = (seatHash(key) % 1000) / 1000
  if (roll < DESK_SHARE) return null
  const pick = Math.floor(((roll - DESK_SHARE) / (1 - DESK_SHARE)) * names.length)
  return names[Math.min(pick, names.length - 1)]
}

/**
 * 자유 자리에 앉은 고양이의 칸. 책상 고양이와 같은 자세 판단(pose)을 받아
 * 옮긴다. 끝난 고양이는 기기를 내려놓고 쉰다.
 */
export function seatFrameFor(pose: string, state: string, t: number): SeatFrame {
  if (pose === "alert") return "alert"
  if (pose === "sleep" || state === "done") return "rest"
  if (pose === "type") return Math.floor(t / 220) % 2 ? "work1" : "work0"
  return "idle"
}
