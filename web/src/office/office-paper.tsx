import { t } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import { useCatNames } from "@/office/cat-names"
import { useCatalog } from "@/office/catalog"
import { TOOL_BUTTON, ToggleMark } from "@/office/office-capture"
import { familyColor } from "@/office/office-draw"
import { coatFor, drawCat } from "@/office/sprites"
import {
  stateDuration,
  stateSince,
  type SessionAgent,
} from "@/lib/agent-office"
import { baseCatName } from "@/lib/agent-office-names"
import { paperFacts, type PaperFacts } from "@/lib/agent-office-paper"

// 하루 사무실 신문. 오늘의 일꾼(도구를 가장 많이 쓴 고양이), 꿀잠 대장(지금
// 가장 오래 조는 고양이), 도구 실패 수, 출근한 고양이 수, 최고 동시 근무를
// 신문 한 장으로 그린다. 캔버스에 그려 그대로 이미지로 저장한다(kttn-paper-…).

const W = 360
const H = 240
const INK = "#2b2a36"
const PAPER = "#f4efe6"
const FONT = '"DungGeunMo", "DotGothic16", monospace'

function drawPaper(
  ctx: CanvasRenderingContext2D,
  facts: PaperFacts,
  today: string,
  now: number
) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, 4)
  ctx.fillRect(0, H - 4, W, 4)
  ctx.fillRect(0, 0, 4, H)
  ctx.fillRect(W - 4, 0, 4, H)
  ctx.textBaseline = "top"
  ctx.font = `24px ${FONT}`
  ctx.fillText(t("paper.title"), 16, 14)
  ctx.font = `12px ${FONT}`
  ctx.textAlign = "right"
  ctx.fillText(today, W - 16, 24)
  ctx.textAlign = "left"
  ctx.fillRect(12, 46, W - 24, 2)
  ctx.fillRect(12, 50, W - 24, 1)
  const lines: string[] = []
  if (facts.busiest)
    lines.push(
      t("paper.busiest", { name: facts.busiest.name, n: facts.busiest.tools })
    )
  if (facts.dozer)
    lines.push(
      t("paper.dozer", {
        name: facts.dozer.name,
        time: stateDuration(facts.dozer.since, now),
      })
    )
  if (facts.failures !== undefined)
    lines.push(t("paper.failures", { n: facts.failures }))
  lines.push(t("paper.cats", { n: facts.cats }))
  if (facts.peak?.count) lines.push(t("paper.peak", { n: facts.peak.count }))
  if (!facts.busiest && !facts.dozer) lines.push(t("paper.quiet"))
  ctx.font = `14px ${FONT}`
  lines.slice(0, 6).forEach((line, index) => {
    ctx.fillText(`■ ${line}`, 16, 62 + index * 26, W - 96)
  })
  // 1면 사진: 오늘의 일꾼(없으면 꿀잠 대장)
  const star = facts.busiest?.key ?? facts.dozer?.key
  if (star) {
    const photo = document.createElement("canvas")
    photo.width = 16
    photo.height = 17
    const pctx = photo.getContext("2d")
    if (pctx) {
      const pose = facts.busiest ? "alert" : "sleep"
      const tie = familyColor(star.split("|")[0] || "agent")
      drawCat(pctx, 8, 16, coatFor(star), tie, pose, "front", 0)
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = "#fffdf7"
      ctx.fillRect(W - 84, 62, 68, 72)
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.strokeRect(W - 84, 62, 68, 72)
      ctx.drawImage(photo, W - 82, 64, 64, 68)
    }
  }
}

/** 안내 줄의 신문 버튼과 신문 창 */
export function OfficePaper({
  agents,
  now,
}: {
  agents: SessionAgent[]
  now: number
}) {
  const names = useCatNames()
  const catalog = useCatalog()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLCanvasElement>(null)
  const today = new Date(now).toLocaleDateString("sv")
  const nameOf = (key: string, saved = "") =>
    names.get(key) || saved || baseCatName(key)
  const facts = paperFacts({
    today,
    now,
    cats: (catalog?.cats ?? []).map((cat) => ({
      key: cat.key,
      name: nameOf(cat.key, cat.cat_name),
      lastSeen: cat.last_seen,
      day: cat.day,
    })),
    sleepers: agents
      .filter((agent) => agent.state === "sleeping")
      .map((agent) => ({
        key: agent.key,
        name: nameOf(agent.key),
        since: stateSince(agent),
      })),
    peak: catalog?.peak,
  })
  const text = JSON.stringify(facts)

  useEffect(() => {
    if (!open) return
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    // 글꼴이 늦게 들어오면 다시 그린다.
    const paint = () => drawPaper(ctx, JSON.parse(text), today, now)
    paint()
    void document.fonts?.ready.then(paint)
  }, [open, text, today, now])

  const save = () => {
    const link = document.createElement("a")
    link.href = ref.current?.toDataURL("image/png") ?? ""
    link.download = `kttn-paper-${today}.png`
    if (link.href) link.click()
  }

  return (
    <>
      <button
        type="button"
        className={TOOL_BUTTON}
        aria-pressed={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ToggleMark on={open} />
        {t("paper.button")}
      </button>
      {open ? (
        <section
          aria-label={t("paper.title")}
          className="fixed top-1/2 left-1/2 z-[80] grid -translate-x-1/2 -translate-y-1/2 gap-1 border-4 border-[#2b2a36] bg-[#2b2a36] p-1 shadow-[6px_6px_0_#2b2a36]"
        >
          <canvas
            ref={ref}
            width={W * 2}
            height={H * 2}
            role="img"
            aria-label={t("paper.title")}
            className="max-w-[90vw] [image-rendering:pixelated]"
            style={{ width: W, height: H }}
          />
          <div className="flex justify-end gap-1">
            <button type="button" className={TOOL_BUTTON} onClick={save}>
              {t("paper.save")}
            </button>
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t("paper.close")}
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
