import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { BASE_PALETTE } from "./palette.ts"

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
