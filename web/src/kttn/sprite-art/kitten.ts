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

// 일하지 않을 때의 새끼 고양이. 부모가 쉬면 앉아 가끔 눈을 감고, 자면 고개를
// 묻고 엎드리고, 사람을 기다리면 눈을 반짝이며 두 앞발을 든다.
const KITTEN_BLINK: Grid = [
  ...KITTEN_HEAD.slice(0, 4),
  "kffffffffk",
  "kfkffffkfk",
  ...KITTEN_HEAD.slice(6),
]
export const KITTEN_IDLE: Grid[] = [
  [...KITTEN_HEAD, ".kjjttjjk.", "..kfkkfk.."],
  [...KITTEN_BLINK, ".kjjttjjk.", "..kfkkfk.."],
  [
    "..........",
    ".k......k.",
    "kfk....kfk",
    "kffkkkkffk",
    "kffffffffk",
    "kfkkffkkfk",
    "kcffnnffck",
    "kjjjttjjjk",
    "kfjjjjjjfk",
    ".kkkkkkkk.",
  ],
  [
    ...KITTEN_HEAD.slice(0, 4),
    "kfhffffhfk",
    "kfeffffefk",
    ...KITTEN_HEAD.slice(6),
    ".kfjttjfk.",
    "..kkkkkk..",
  ],
]
export const KITTEN_FRAME = { sit: 0, blink: 1, sleep: 2, alert: 3 } as const
