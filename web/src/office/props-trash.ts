// 소품 치우기. 휴게 공간의 휴지통 소품([data-trash]) 위로 소품을 끌어다 놓으면
// 먼지 구름이 일며 사라진다. 들여온 소품은 설정 파일에서 지우고, 원래 있던
// 소품은 치웠다는 표시(GONE 자리)를 남긴다. 치운 기본 소품은 소품 목록에서
// 다시 들여온다. 서버는 자리를 ±2000px까지만 받으므로 그 끝을 표시로 쓴다.

export const GONE = -2000

/** 치운 기본 소품인지 */
export const gone = (offset?: { x: number; y: number }) =>
  offset?.x === GONE && offset.y === GONE

/** 화면 자리(x, y) 아래의 휴지통. 끌고 있는 소품 자신은 뺀다. */
export function trashAt(x: number, y: number, self: Element) {
  return document
    .elementsFromPoint(x, y)
    .map((el) => el.closest<HTMLElement>("[data-trash]"))
    .find(
      (el): el is HTMLElement =>
        Boolean(el) && el !== self && !self.contains(el ?? null)
    )
}

let hot: HTMLElement | undefined

/** 끄는 소품이 올라간 휴지통을 밝힌다(없으면 끈다). */
export function lightTrash(el?: HTMLElement) {
  if (hot === el) return
  if (hot) hot.style.filter = ""
  hot = el
  if (el)
    el.style.filter =
      "drop-shadow(2px 0 0 #fbbf24) drop-shadow(-2px 0 0 #fbbf24) drop-shadow(0 2px 0 #fbbf24) drop-shadow(0 -2px 0 #fbbf24)"
}

// 먼지 구름 한 조각. 도트 덩어리가 사방으로 부풀며 옅어진다.
const PUFFS = [
  [-14, -10, 8],
  [12, -12, 10],
  [-16, 6, 10],
  [14, 8, 8],
  [0, -18, 6],
  [0, 4, 12],
] as const

/** 화면 자리(x, y)에 먼지 구름을 잠깐 피운다. */
export function puff(x: number, y: number) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  for (const [dx, dy, size] of PUFFS) {
    const dot = document.createElement("div")
    dot.setAttribute("aria-hidden", "true")
    Object.assign(dot.style, {
      position: "fixed",
      left: `${x - size / 2}px`,
      top: `${y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: "#d6d0c4",
      boxShadow: "2px 2px 0 #9a9384",
      pointerEvents: "none",
      zIndex: "90",
    })
    document.body.append(dot)
    if (still) {
      window.setTimeout(() => dot.remove(), 300)
      continue
    }
    dot
      .animate(
        [
          { transform: "translate(0, 0) scale(0.6)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.4)`, opacity: 0 },
        ],
        { duration: 450, easing: "steps(5)" }
      )
      .finished.finally(() => dot.remove())
  }
}
