// 책상 옆에 그릴 새끼 고양이(하위 에이전트)를 고른다. 서버는 최대 8마리를 주고
// 화면은 넷까지 그린다.

/** 책상 옆에 그리는 새끼 고양이 수 */
export const SHOWN_MINIONS = 4

/**
 * 그릴 새끼 고양이. 앞의 넷을 그 자리 그대로 두고, 가려진 새끼가 사람을
 * 기다리면(waiting) 보이는 자리 가운데 기다리지 않는 뒤쪽 새끼 대신 그 자리에
 * 그린다. 다른 새끼는 자리를 옮기지 않는다.
 */
export function shownMinions<T extends { waiting?: boolean }>(
  minions: T[],
  max = SHOWN_MINIONS
): T[] {
  const shown = minions.slice(0, max)
  for (const hidden of minions.slice(max)) {
    if (!hidden.waiting) continue
    let k = shown.length - 1
    while (k >= 0 && shown[k].waiting) k--
    if (k < 0) break
    shown[k] = hidden
  }
  return shown
}
