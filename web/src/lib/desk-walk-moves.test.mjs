import assert from "node:assert/strict"
import test from "node:test"

import { awayOnVisit } from "../kttn/kttn-walk.ts"
import { moveCat } from "../kttn/cat-move.ts"
import { toSessionAgents } from "./kttn.ts"
import { deskLayout, seatPoint } from "./desk-layout.ts"
import { deskGrid } from "./desk-walk.ts"
import { isFree } from "./walk-grid.ts"

// 배치가 걷는 중에 바뀌어도 모든 장면에서 고양이 발밑이 그 배치의 걸을 수
// 있는 칸에 있는지 본다. 그림 쪽(kttn-canvas)과 같은 차례로 moveCat을 부른다.

const START = Date.parse("2026-11-25T05:00:00Z")
const STATES = ["idle", "sleeping", "idle", "editing", "sleeping", "idle"]

function agents(count, from = 0) {
  const rows = Array.from({ length: count }, (_, k) => {
    const i = from + k
    return {
      key: `claude|cat-${i}`,
      source: "claude",
      session: `cat-${i}`,
      project: "kttn",
      state: STATES[i % STATES.length],
      detail: "",
      minions: [],
      tool_count: 10,
      started_as: i % 2 ? "resume" : "startup",
      status_since: "2026-11-25T04:00:00Z",
      updated_at: "2026-11-25T04:00:00Z",
    }
  })
  return toSessionAgents({ agents: rows }, START)
}

// 자유 자리 상자(desk-walk.test와 같은 크기 몇 가지)
const SEAT = { w: 32, h: 24, ax: 16, ay: 23 }
function freeFor(layout, seated, mixed) {
  return seated.map((_, index) => {
    if (!mixed || index % 2 === 0) return null
    const at = seatPoint(layout, index)
    return { x: at.x - SEAT.ax, y: at.y - SEAT.ay, w: SEAT.w, h: SEAT.h }
  })
}

/** 장면마다 배치를 바꿔 가며 걷게 하고, 발밑이 걸을 수 없는 곳이면 실패한다. */
function run(label, steps) {
  const walkers = new Map()
  let t = START
  for (const { seated, cols, mixed, frames } of steps) {
    const room = deskLayout(seated.length, cols)
    const grid = deskGrid(room, seated.length, freeFor(room, seated, mixed))
    const plan = `${room.w}|${room.h}|${room.cols}|${mixed}|${seated.map((a) => a.key).join(",")}`
    for (let f = 0; f < frames; f++) {
      t += 33
      seated.forEach((agent, index) => {
        const walker = moveCat(walkers, agent, index, {
          room,
          seated,
          t,
          now: t,
          dt: 33,
          still: false,
          nearby: { tower: true, props: 2 },
          grid,
          plan,
        })
        if (walker.out || awayOnVisit(walker)) return
        assert.ok(
          isFree(grid, walker),
          `${label}: ${agent.key} ${JSON.stringify({ x: walker.x, y: walker.y })} ${cols}열 ${seated.length}마리`
        )
      })
    }
  }
}

// 걷는 중에 바뀌도록 짧게(1~3초) 돌리고 바꾼다. 1분 첫머리(산책·만남)도 지난다.
const SHORT = 60
const LONG = 2200

test("8마리에서 3마리로 줄어도 남은 고양이가 구역 밖으로 나가지 않는다", () => {
  const all = agents(8)
  run("8→3", [
    { seated: all, cols: 4, frames: SHORT },
    { seated: all.slice(5), cols: 4, frames: LONG },
  ])
})

test("열 수가 3에서 4로, 다시 2로 바뀌어도(창 폭) 걷는 칸에 있다", () => {
  const all = agents(7)
  run("열", [
    { seated: all, cols: 3, frames: SHORT },
    { seated: all, cols: 4, frames: 40 },
    { seated: all, cols: 2, frames: 30 },
    { seated: all, cols: 1, frames: LONG },
  ])
})

test("자유 자리가 섞이고 고양이가 늘었다 줄었다 해도 걷는 칸에 있다", () => {
  const all = agents(12)
  run("섞임", [
    { seated: all.slice(0, 3), cols: 3, mixed: true, frames: SHORT },
    { seated: all, cols: 4, mixed: true, frames: 90 },
    { seated: all.slice(2, 9), cols: 3, mixed: false, frames: 45 },
    { seated: all.slice(4), cols: 2, mixed: true, frames: LONG },
  ])
})

test("1분 내내 걸어도(산책, 만남, 나들이) 걷는 칸을 벗어나지 않는다", () => {
  for (const cols of [1, 2, 3, 4])
    run(`1분 ${cols}열`, [{ seated: agents(9), cols, mixed: cols % 2 === 0, frames: 1900 }])
})
