import type { Grid } from "./palette"

// 새끼 고양이(10×10). 하위 에이전트용으로, 큰 고양이를 줄이면 눈·코가 뭉개져
// 따로 그린다. 두 칸은 앞발을 번갈아 드는 자판 치기다.
const KITTEN_HEAD: Grid = [
  ".k......k.",
  "kfk....kfk",
  "kffkkkkffk",
  "kffffffffk",
  "kfeffffefk",
  "kfeffffefk",
  "kcffnnffck",
  ".kkkkkkkk.",
]
export const KITTEN: Grid[] = [
  [...KITTEN_HEAD, ".kfjttjjk.", "..kkkkkk.."],
  [...KITTEN_HEAD, ".kjjttjfk.", "..kkkkkk.."],
]

// 사람을 기다리는 새끼 고양이(서버가 그 하위 에이전트에 waiting을 단다). 눈을
// 반짝이며 고개를 든다. 발밑은 자판 치기와 같은 맨 아랫줄이다.
export const KITTEN_WAIT: Grid = [
  ...KITTEN_HEAD.slice(0, 4),
  "kfhffffhfk",
  "kfeffffefk",
  ...KITTEN_HEAD.slice(6),
  ".kfjttjfk.",
  "..kkkkkk..",
]
