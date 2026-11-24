// 비밀 키. 위 위 아래 아래 왼쪽 오른쪽 왼쪽 오른쪽 B A를 차례로 누르면 사무실
// 고양이들이 잠깐 춤춘다. 그림은 office/dance.ts와 office-canvas.tsx.

export const SECRET = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
]

/**
 * 지금까지 맞게 누른 수(matched)에 새 키를 더한 결과. 다 맞으면 done이 참이고
 * 처음부터 다시 센다. 틀리면 그 키가 첫 키와 같을 때만 1부터 다시 센다.
 */
export function pressSecret(matched: number, key: string) {
  const k = key.length === 1 ? key.toLowerCase() : key
  if (k === SECRET[matched]) {
    const next = matched + 1
    return next === SECRET.length
      ? { matched: 0, done: true }
      : { matched: next, done: false }
  }
  // 위 위 위처럼 처음 두 키가 같으므로, 틀린 키가 위면 둘째까지 맞은 것으로 본다.
  if (k === SECRET[0]) return { matched: matched >= 2 ? 2 : 1, done: false }
  return { matched: 0, done: false }
}

/** 춤출 때의 자세와 방향(250ms마다 바뀐다)과 몸을 들어 올리는 높이 */
export function danceStep(t: number) {
  const beat = Math.floor(t / 250) % 4
  return {
    pose: beat % 2 ? "walk" : "alert",
    dir: beat < 2 ? "left" : "right",
    hop: beat % 2 ? 2 : 0,
  } as const
}
