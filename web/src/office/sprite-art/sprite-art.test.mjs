import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { BASE_PALETTE } from "./palette.ts"
import { SEATS } from "./seats.ts"

// 소품은 BASE_PALETTE로만 그린다(item-draw.ts). 고양이 털 키(f·s·e·t)처럼
// 팔레트에 없는 글자는 건너뛰어 빈칸이 되는데 tsc는 잡지 못한다. 그래서
// 그림 파일을 모두 읽어 칸 글자와 줄 길이를 직접 확인한다.
const dir = new URL(".", import.meta.url)
const files = readdirSync(dir)
  .filter((name) => /^items-\d+\.ts$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))

const sets = await Promise.all(
  files.map(async (name) => {
    const mod = await import(new URL(name, dir).href)
    const [exportName, items] = Object.entries(mod).find(([key]) =>
      key.startsWith("ITEMS_"),
    )
    return { name, exportName, items }
  }),
)

test("그림 파일이 있고 파일마다 ITEMS_ 묶음을 하나 낸다", () => {
  assert.ok(files.length > 0)
  for (const { name, items } of sets) assert.ok(items, `${name}: ITEMS_ 없음`)
})

test("모든 소품 칸은 BASE_PALETTE 키이거나 투명(.)이다", () => {
  const bad = []
  for (const { name, items } of sets)
    for (const [item, grid] of Object.entries(items))
      grid.forEach((row, y) =>
        [...row].forEach((cell, x) => {
          if (cell !== "." && !(cell in BASE_PALETTE))
            bad.push(`${name} ${item} (${x},${y}) "${cell}"`)
        }),
      )
  assert.deepEqual(bad, [])
})

test("소품마다 줄 길이가 모두 같고 비어 있지 않다", () => {
  const bad = []
  for (const { name, items } of sets)
    for (const [item, grid] of Object.entries(items)) {
      const width = grid[0]?.length ?? 0
      if (!width) bad.push(`${name} ${item}: 빈 그림`)
      grid.forEach((row, y) => {
        if (row.length !== width)
          bad.push(`${name} ${item} ${y}행: ${row.length} != ${width}`)
      })
    }
  assert.deepEqual(bad, [])
})

test("소품 이름은 파일끼리 겹치지 않는다", () => {
  const seen = new Map()
  const dup = []
  for (const { name, items } of sets)
    for (const item of Object.keys(items)) {
      if (seen.has(item)) dup.push(`${item}: ${seen.get(item)}, ${name}`)
      seen.set(item, name)
    }
  assert.deepEqual(dup, [])
})

test("sprite-data.ts가 모든 그림 파일을 합친다", () => {
  const index = readFileSync(new URL("../sprite-data.ts", dir), "utf8")
  const missing = sets
    .filter(
      ({ name, exportName }) =>
        !index.includes(`./sprite-art/${name.replace(/\.ts$/, "")}"`) ||
        !index.includes(`...${exportName},`),
    )
    .map(({ name }) => name)
  assert.deepEqual(missing, [])
})

test("자유 자리 그림은 팔레트·고양이 키·화면(!)만 쓰고 칸 크기가 같다", () => {
  const frames = ["work0", "work1", "idle", "alert", "rest", "empty"]
  const bad = []
  for (const [name, seat] of Object.entries(SEATS)) {
    const first = seat.frames.idle
    const width = first[0].length
    const height = first.length
    if (width > 32 || height > 24)
      bad.push(`${name}: ${width}x${height} > 32x24`)
    for (const point of ["anchor", "head"]) {
      const { x, y } = seat[point]
      if (x < 0 || y < 0 || x >= width || y >= height)
        bad.push(`${name}: ${point} (${x},${y}) 밖`)
    }
    for (const frame of frames) {
      const grid = seat.frames[frame]
      if (!grid) {
        bad.push(`${name}.${frame} 없음`)
        continue
      }
      if (grid.length !== height)
        bad.push(`${name}.${frame} 높이 ${grid.length}`)
      grid.forEach((row, y) => {
        if (row.length !== width)
          bad.push(`${name}.${frame} ${y}행 폭 ${row.length}`)
        ;[...row].forEach((cell, x) => {
          if (
            cell !== "." &&
            cell !== "!" &&
            !"fset".includes(cell) &&
            !(cell in BASE_PALETTE)
          )
            bad.push(`${name}.${frame} (${x},${y}) "${cell}"`)
        })
      })
    }
    // 고양이가 있는 칸에는 넥타이(t)가 두 칸 넘게 보이고, 빈자리에는 고양이가 없다.
    for (const frame of frames) {
      const ties = seat.frames[frame].join("").split("t").length - 1
      if (frame === "empty" ? ties > 0 : ties < 2)
        bad.push(`${name}.${frame} 넥타이 ${ties}칸`)
    }
  }
  assert.deepEqual(bad, [])
})
