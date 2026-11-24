import type { Grid } from "./palette"

// 바늘 없는 벽시계판. clockAt이 바늘을 그려 넣는다.
const CLOCK_FACE: Grid = [
  "...kkkk...",
  ".kkwwwwkk.",
  ".kwwwwwwk.",
  "kwwwwwwwwk",
  "kwwwwwwwwk",
  "kwwwwwwwwk",
  "kwwwwwwwwk",
  ".kwwwwwwk.",
  ".kkwwwwkk.",
  "...kkkk...",
]

/** 시·분에 맞춰 바늘을 그린 벽시계(ITEMS.clock과 같은 10×10). 분침이 시침보다 길다. */
export function clockAt(hours: number, minutes: number): Grid {
  const cells = CLOCK_FACE.map((row) => [...row])
  const hand = (turn: number, length: number, thick = false) => {
    const angle = turn * 2 * Math.PI
    // 굵은 바늘은 바늘 방향에 수직인 옆 칸도 칠한다.
    const side = thick
      ? [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))]
      : null
    // 0.5칸씩 찍어 비스듬한 바늘도 같은 칸을 두 번 찍어 짧아지지 않게 한다.
    for (let step = 1; step <= length; step += 0.5) {
      const x = Math.round(5 + Math.sin(angle) * step)
      const y = Math.round(5 - Math.cos(angle) * step)
      // 테두리에 닿는 칸은 비워 바늘이 테두리와 붙지 않게 한다.
      const touchesRim = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => CLOCK_FACE[ny]?.[nx] === "k")
      if (touchesRim) continue
      if (cells[y][x] === "w") cells[y][x] = "k"
      if (side && cells[y + side[1]]?.[x + side[0]] === "w") {
        cells[y + side[1]][x + side[0]] = "k"
      }
    }
  }
  hand(minutes / 60, 3.5)
  // 시침은 굵게 그려 분침과 일직선이 되어도 구분된다.
  hand(((hours % 12) + minutes / 60) / 12, 2, true)
  cells[5][5] = "k"
  return cells.map((row) => row.join(""))
}
