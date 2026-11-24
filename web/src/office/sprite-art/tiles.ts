import type { Grid } from "./palette"

/** 방 바닥·벽 타일. CSS 배경으로 반복해 깐다. */
export const TILES = {
  // 마루(64×32). 널 한 줄이 8줄이다. 널을 길게 두고 이음매 간격과 널 색을
  // 줄마다 달리해 벽돌처럼 반복돼 보이지 않게 한다.
  wood: [
    ...plank(
      [0, 40],
      [false, true],
      [
        [3, 6, 15],
        [5, 44, 56],
        [2, 27, 33],
      ]
    ),
    ...plank(
      [22],
      [false],
      [
        [2, 30, 41],
        [5, 3, 10],
        [4, 52, 60],
      ]
    ),
    ...plank(
      [10, 52],
      [true, false],
      [
        [3, 14, 22],
        [5, 33, 47],
        [2, 56, 62],
      ]
    ),
    ...plank(
      [34],
      [true],
      [
        [2, 40, 49],
        [5, 12, 26],
        [3, 0, 4],
      ]
    ),
  ],
  check: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) =>
      (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? "L" : "l"
    ).join("")
  ),
  // 사무용 카펫 타일. 8칸 정사각형마다 결 방향이 엇갈리고 보풀이 흩어진다.
  carpet: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      if (speck(x, y, 67)) return "*"
      const across = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
      return (across ? y : x) % 2 ? "-" : "+"
    }).join("")
  ),
  // 큰 돌 타일. 16칸마다 줄눈이 지나고 밝은 반점이 박혀 있다.
  stone: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      // 줄마다 반 장씩 어긋나게 깔고, 판마다 위·왼쪽은 밝게 아래·오른쪽은 어둡게 모를 낸다.
      const sx = (x + (y >= 16 ? 8 : 0)) % 16
      const sy = y % 16
      if (sx === 15 || sy === 15) return "#"
      if (sx === 0 || sy === 0) return "~"
      if (sx === 14 || sy === 14) return "%"
      if (speck(x, y, 41)) return "~"
      return "="
    }).join("")
  ),
  // 자작나무 쪽매 마루. 16칸 블록마다 널 방향이 가로·세로로 바뀐다.
  parquet: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      const across = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0
      const t = (across ? y : x) % 4
      return t === 3 ? "m" : t === 0 ? "i" : "a"
    }).join("")
  ),
  // 테라조. 크림색 바탕에 분홍·하늘·노랑·회색 돌 조각이 드문드문 박힌다.
  terrazzo: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      if (speck(x, y, 79)) return "n"
      if (speck(x + 11, y + 5, 83)) return "Z"
      if (speck(x + 23, y + 17, 89)) return "S"
      if (speck(x + 37, y + 9, 109)) return "#"
      if (speck(x + 5, y + 29, 53)) return "#"
      return "="
    }).join("")
  ),
  // 방향 없는 복도 바닥(14×14). 방 돌 타일보다 어둡고 따뜻한 7칸 타일 네 장을
  // 엇갈린 밝기로 깔아, 가로·세로 복도와 꺾이는 자리에 그대로 이어 깐다.
  hallFloor: Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: 14 }, (_, x) => {
      if (x % 7 === 6 || y % 7 === 6) return "&"
      const light = (Math.floor(x / 7) + Math.floor(y / 7)) % 2 === 0
      if (x % 7 === 0 && y % 7 === 0) return light ? "=" : "%"
      return light ? "%" : "^"
    }).join("")
  ),
  wall: [
    ...Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 32 }, (_, x) =>
        x % 8 === 0 && y < 11 ? "V" : "v"
      ).join("")
    ),
    "k".repeat(32),
    "y".repeat(32),
    "y".repeat(32),
    "Y".repeat(32),
  ],
} satisfies Record<string, Grid>

// 바닥 반점 자리. 이차식을 써서 줄지어 늘어서지 않고 흩어진다.
function speck(x: number, y: number, n: number) {
  return (x * x * 31 + y * y * 17 + x * y * 7 + x * 3 + y * 5) % n === 0
}

// 널 한 줄. seams는 이음매 x 위치, dark는 이음매 뒤 널마다 어두운 색을 쓸지
// (마지막 널은 타일 오른쪽 끝을 넘어 맨 앞 널로 이어진다), grain은 [y, 시작
// x, 끝 x] 결 줄이다.
function plank(
  seams: number[],
  dark: boolean[],
  grain: [number, number, number][]
): string[] {
  const board = (x: number) =>
    dark[
      (seams.filter((seam) => seam <= x).length + seams.length - 1) %
        seams.length
    ]
  return Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      if (y === 7 || seams.includes(x)) return "P"
      if (grain.some(([gy, from, to]) => gy === y && x >= from && x < to))
        return "O"
      return board(x) ? "Q" : "o"
    }).join("")
  )
}
