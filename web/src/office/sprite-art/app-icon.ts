import { HEAD } from "./cat-pose"
import type { Grid } from "./palette"

// 사무실 앱 아이콘(16×16). 사무실 고양이와 같은 머리에 셔츠 깃·넥타이·정장까지
// 보이는 반신상이다. "@"는 배경, "."은 투명(둥근 모서리)이다.

// 머리 아래 정장 가슴께. 아이콘 아래 끝까지 이어진다.
const BUST: Grid = [
  "...kjwwttwwjk...",
  "..kjjjwttwjjjk..",
  "..kjjjjttjjjjk..",
  "..kjjjjjjjjjjk..",
]

/** 배경 없는 반신상(16×16). 마스커블 아이콘은 이것을 꽉 찬 배경 위에 얹는다. */
export const APP_ICON_FIGURE: Grid = [
  "................",
  "................",
  ...HEAD.slice(1),
  ...BUST,
]

// 둥근 모서리 배경 칸인지. 위아래 두 줄씩 모서리를 깎는다.
const inBackground = (x: number, y: number) => {
  const inset = y === 0 || y === 15 ? 2 : y === 1 || y === 14 ? 1 : 0
  return x >= inset && x <= 15 - inset
}

/** 둥근 네모 배경에 반신상을 얹은 일반 아이콘(16×16). */
export const APP_ICON: Grid = APP_ICON_FIGURE.map((row, y) =>
  [...row]
    .map((cell, x) => (cell !== "." ? cell : inBackground(x, y) ? "@" : "."))
    .join("")
)

/** 아이콘 색. 흰 털(눈송이) 고양이를 흰 배경("@")에 얹는다. 검은 테두리가 있어 털과 배경이 섞이지 않는다. 나머지 키는 BASE_PALETTE를 쓴다. */
export const APP_ICON_COLORS: Record<string, string> = {
  f: "#f6f2ea",
  s: "#dcd5c8",
  e: "#2b2a36",
  t: "#ff8709",
  "@": "#ffffff",
}
