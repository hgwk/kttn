// 자동화실 그리기. 바닥과 벽은 방 틀(HTML)이 깔고, 캔버스는 투명 바탕에
// 고양이 사무실 가구로 기계실을 그린다. 자동화 하나가 단말 한 대이며,
// 단말 화면으로 실행 중(초록 글줄)·실패(빨간 깜빡임과 연기)·끝남(체크)을 보인다.
import { drawItem } from "@/office/sprites"
import { rect } from "@/office/pixel"
import { drawIcon } from "@/office/pixel-font"
import type { OfficeAutomation } from "@/lib/agent-office"

// 한 줄에 넷씩 세워 자동화가 많아도 기계실이 길어져 아래 목록을 밀어내지
// 않게 한다. 책상(30px)이 6px씩 떨어진다.
export const MAX_STATIONS = 12
const COLS = 4
const GAP_X = 36
const LEFT = 21
const GAP_Y = 36
const TOP = 22
export const AUTOMATION_W = 150

export function automationRoomHeight(count: number) {
  const rows = Math.max(1, Math.ceil(Math.min(count, MAX_STATIONS) / COLS))
  return TOP + rows * GAP_Y + 2
}

export function stationSpot(index: number) {
  return {
    x: LEFT + (index % COLS) * GAP_X,
    y: TOP + Math.floor(index / COLS) * GAP_Y,
  }
}

export function drawAutomationRoom(
  ctx: CanvasRenderingContext2D,
  automations: OfficeAutomation[],
  t: number
) {
  const h = automationRoomHeight(automations.length)
  ctx.clearRect(0, 0, AUTOMATION_W, h)
  // 벽을 따라 늘어선 서버 캐비닛. 불빛이 번갈아 깜빡인다.
  for (let i = 0; i < 3; i++) {
    const sx = 2 + i * 49
    drawItem(ctx, "server", sx, 2)
    const on = Math.floor(t / 300 + i) % 3
    rect(ctx, sx + 6 + on * 4, 6, 2, 1, "#4ade80")
  }
  automations
    .slice(0, MAX_STATIONS)
    .forEach((automation, index) => drawStation(ctx, index, automation, t))
}

function drawStation(
  ctx: CanvasRenderingContext2D,
  index: number,
  automation: OfficeAutomation,
  t: number
) {
  const { x, y } = stationSpot(index)
  drawItem(ctx, "darkDesk", x - 15, y + 12)
  drawItem(ctx, "monitor", x - 8, y + 1)
  const sx = x - 6
  const sy = y + 3
  if (automation.state === "running") {
    rect(ctx, sx, sy, 12, 6, "#052e16")
    const lines = Math.floor(t / 180) % 3
    for (let i = 0; i <= lines; i++)
      rect(ctx, sx + 1, sy + 1 + i * 2, 4 + ((i * 3) % 6), 1, "#4ade80")
  } else if (automation.state === "failed") {
    rect(ctx, sx, sy, 12, 6, Math.floor(t / 400) % 2 ? "#7f1d1d" : "#dc2626")
    drawIcon(ctx, "alert", sx + 4, sy, "#fee2e2")
    // 모니터 위로 피어오르는 연기
    for (let i = 0; i < 3; i++) {
      const rise = (Math.floor(t / 160) + i * 5) % 14
      rect(ctx, x - 2 + (i % 2) * 3, y - rise, 2, 2, "#9ca3af")
    }
  } else if (automation.state === "held") {
    // 고장이 아니라 판정을 미룬 후보가 남은 상태다. 깜빡이지 않는다.
    rect(ctx, sx, sy, 12, 6, "#334155")
    drawIcon(ctx, "held", sx + 4, sy, "#cbd5e1")
  } else {
    rect(ctx, sx, sy, 12, 6, "#14532d")
    drawIcon(ctx, "done", sx + 4, sy, "#86efac")
  }
}
