// 가구·소품과 바닥·벽 타일을 그린다. 가구는 캔버스에 찍고, 타일은 SVG 데이터
// URI로 바꿔 CSS 배경으로 쓴다.
import {
  BASE_PALETTE,
  ITEMS,
  TILES,
  type Grid,
  type ItemName,
} from "@/office/sprite-data"
import { sheetCanvas } from "@/office/sprites"

const itemCache = new Map<ItemName, HTMLCanvasElement>()

/** 가구 하나를 왼쪽 위 (x, y)에 그린다. */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  name: ItemName,
  x: number,
  y: number
) {
  let canvas = itemCache.get(name)
  if (!canvas) {
    canvas = sheetCanvas([ITEMS[name]], BASE_PALETTE)
    itemCache.set(name, canvas)
  }
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, Math.round(x), Math.round(y))
}

/** 그때그때 만든 격자(예: 지금 시각의 벽시계) 하나를 왼쪽 위 (x, y)에 그린다. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number
) {
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sheetCanvas([grid], BASE_PALETTE), Math.round(x), Math.round(y))
}

// 격자를 SVG로. 같은 색이 이어진 칸은 사각형 하나로 묶는다. 문자열이라 서버
// 렌더링에서도 같은 값이 나온다.
function svgUri(grid: Grid) {
  const rects: string[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      let run = 1
      while (row[x + run] === row[x]) run++
      const color = row[x] === "." ? undefined : BASE_PALETTE[row[x]]
      if (color)
        rects.push(
          `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`
        )
      x += run
    }
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${grid[0].length}" height="${grid.length}" shape-rendering="crispEdges">${rects.join("")}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** 바닥·벽 CSS 배경으로 쓰는 타일 데이터 URI. */
export const TILE = {
  wood: svgUri(TILES.wood),
  check: svgUri(TILES.check),
  carpet: svgUri(TILES.carpet),
  stone: svgUri(TILES.stone),
  parquet: svgUri(TILES.parquet),
  terrazzo: svgUri(TILES.terrazzo),
  // 복도 바닥. 방향이 없어 가로·세로·꺾이는 자리에 같은 타일을 깐다.
  hallFloor: svgUri(TILES.hallFloor),
  wall: svgUri(TILES.wall),
}

/** 방 바닥으로 깔 수 있는 무늬. */
export type Floor =
  | "wood"
  | "check"
  | "carpet"
  | "stone"
  | "parquet"
  | "terrazzo"
