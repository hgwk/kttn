import { t, type MessageKey } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import { useCatNames } from "@/office/cat-names"
import { TOOL_BUTTON, ToggleMark } from "@/office/office-capture"
import { familyColor } from "@/office/office-draw"
import { coatFor, drawCat } from "@/office/sprites"
import type { SessionAgent } from "@/lib/agent-office"
import { baseCatName, levelFor } from "@/lib/agent-office-names"
import { apiFetch } from "@/lib/screen-key"
import { cn } from "@/lib/utils"
import { titlesFor, type TitleId } from "@/lib/agent-office-titles"
import {
  setCatalog,
  useCatalog,
  type Catalog,
  type CatRecord,
} from "@/office/catalog"

// 고양이 도감. 서버가 남긴 세션 기록(/api/cats: 처음 본 날, 마지막으로 본 날,
// 누적 도구 수, 처음 붙은 이름)으로 퇴근한 고양이까지 보인다. 고양이 이름은
// 화면이 정하므로(보이는 고양이끼리 겹치지 않게) 처음 본 이름을 서버에 알려
// 남긴다. 서버에 도감이 없으면(이전 판) 버튼을 숨긴다.

async function loadCats(): Promise<Catalog | null> {
  try {
    const response = await apiFetch("/api/cats", { cache: "no-store" })
    if (!response.ok) return null
    const body = (await response.json()) as Partial<Catalog>
    if (!Array.isArray(body.cats)) return null
    const peak = body.peak
    const valid = peak && typeof peak.count === "number"
    return { cats: body.cats, peak: valid ? peak : undefined }
  } catch {
    return null
  }
}

function CatPicture({ record }: { record: CatRecord }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, 16, 17)
    const tie = familyColor(record.source || "agent")
    drawCat(ctx, 8, 16, coatFor(record.key), tie, "sit", "front", 0)
  }, [record.key, record.source])
  return (
    <canvas
      ref={ref}
      width={16}
      height={17}
      aria-hidden="true"
      className="size-12 shrink-0 [image-rendering:pixelated]"
    />
  )
}

/** 도감 카드의 칭호 줄 */
function TitleChips({ ids }: { ids: TitleId[] }) {
  if (!ids.length) return null
  return (
    <p className="flex flex-wrap gap-0.5">
      {ids.map((id) => (
        <span key={id} className="bg-amber-300 px-0.5 text-[10px]">
          {t(`title.${id}` as MessageKey)}
        </span>
      ))}
    </p>
  )
}

// 서버 시각은 UTC라 이 컴퓨터 날짜로 바꿔 보인다(YYYY-MM-DD).
const day = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv")
}

/** 안내 줄의 도감 버튼과 도감 창 */
export function CatBook({ agents }: { agents: SessionAgent[] }) {
  const names = useCatNames()
  const catalog = useCatalog()
  const cats = catalog?.cats ?? null
  const [open, setOpen] = useState(false)
  // 이미 서버에 이름을 알린 세션
  const told = useRef(new Set<string>())
  // 지금 이름을 보내는 중인 세션(같은 이름을 겹쳐 보내지 않는다)
  const sending = useRef(new Set<string>())
  // 초기화는 두 번 눌러야 한다(한 번 누르면 5초 동안 확인 단계)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 5000)
    return () => window.clearTimeout(timer)
  }, [armed])
  const clear = async () => {
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    try {
      const response = await apiFetch("/api/cats", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
      })
      if (response.ok) {
        told.current.clear()
        setCatalog(await loadCats())
      }
    } catch {
      // 다음 새로 고침에 다시 읽는다.
    }
  }

  useEffect(() => {
    let live = true
    const refresh = () =>
      void loadCats().then((next) => live && setCatalog(next))
    refresh()
    const timer = window.setInterval(refresh, open ? 5_000 : 60_000)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [open])

  // 처음 보는 고양이의 이름을 서버에 남긴다(서버는 이름이 비어 있을 때만 채운다).
  // 서버 도감에 있고 이름이 빈 고양이에게만 보낸다(초기화 직후나 기록하지 않는
  // 세션에 보내면 404다). 성공했을 때만 보낸 것으로 쳐서, 실패하면 다음 새로
  // 고침 때 다시 보낸다.
  useEffect(() => {
    if (!cats) return
    const recorded = new Map(cats.map((cat) => [cat.key, cat.cat_name]))
    for (const agent of agents) {
      const name = names.get(agent.key)
      const key = agent.key
      // 서버가 기록하지 않는 세션(claude -p 같은 headless)은 목록에 없어 빠진다.
      if (!name || recorded.get(key) !== "") continue
      if (told.current.has(key) || sending.current.has(key)) continue
      sending.current.add(key)
      void apiFetch("/api/cats/name", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, cat_name: name }),
      })
        .then((response) => {
          if (response.ok) told.current.add(key)
        })
        .catch(() => {})
        .finally(() => sending.current.delete(key))
    }
  }, [agents, cats, names])

  if (!cats) return null
  const working = new Set(agents.map((agent) => agent.key))
  return (
    <>
      <button
        type="button"
        className={TOOL_BUTTON}
        aria-pressed={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ToggleMark on={open} />
        {t("book.button")}
      </button>
      {open ? (
        <section
          aria-labelledby="cat-book-title"
          className="fixed inset-x-4 top-4 bottom-12 z-[80] mx-auto flex max-w-3xl flex-col border-4 border-[#2b2a36] bg-[#f4efe6] text-[#2b2a36] shadow-[6px_6px_0_#2b2a36]"
        >
          <header className="flex items-center justify-between bg-[#2b2a36] px-2 py-1 text-[#f7f2e8]">
            <h3 id="cat-book-title" className="text-xs">
              {t("book.title", { n: cats.length })}
              {/* 사무실 기록: 동시에 일한 고양이 수의 최고 */}
              {catalog?.peak?.count ? (
                <span className="ml-2 opacity-80">
                  {t("book.peak", {
                    n: catalog.peak.count,
                    date: day(catalog.peak.at),
                  })}
                </span>
              ) : null}
            </h3>
            <button
              type="button"
              // 켜고 끄는 버튼이 아니라 확인 단계라 aria-pressed 없이 글자만 바뀐다.
              className={cn(
                "ml-auto px-1 text-[10px] opacity-80 hover:opacity-100",
                armed && "bg-[#c0392b] opacity-100"
              )}
              onClick={() => void clear()}
            >
              {armed ? t("book.clearConfirm") : t("book.clear")}
            </button>
            {/* 확인 단계를 화면 낭독기에 알린다(포커스된 버튼 이름 변화는 놓치기 쉽다). */}
            <span role="status" className="sr-only">
              {armed ? t("book.clearHint") : ""}
            </span>
            <button
              type="button"
              aria-label={t("book.close")}
              className="px-1 text-xs hover:text-amber-300"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>
          {cats.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2 overflow-y-auto p-2">
              {[...cats].reverse().map((cat) => (
                <li
                  key={cat.key}
                  className="flex items-center gap-2 border-2 border-[#2b2a36] bg-[#fffdf7] p-1.5"
                >
                  <CatPicture record={cat} />
                  <div className="grid min-w-0 gap-0.5 text-[11px] leading-tight">
                    <p className="truncate font-bold" title={cat.session_name}>
                      {cat.cat_name ||
                        names.get(cat.key) ||
                        baseCatName(cat.key)}
                      <span className="ml-1 font-normal">
                        {t("book.level", { n: levelFor(cat.tools).level })}
                      </span>
                    </p>
                    <p className="truncate" title={cat.folder}>
                      {cat.project}
                    </p>
                    <p>
                      {t("book.tools", { n: cat.tools })}
                      {" | "}
                      {t("book.first", { date: day(cat.first_seen) })}
                    </p>
                    <TitleChips
                      ids={titlesFor(
                        {
                          tools: cat.tools,
                          firstSeen: cat.first_seen,
                          nightOwl: cat.night_owl,
                        },
                        Date.now()
                      )}
                    />
                    <p
                      className={
                        working.has(cat.key) ? "text-emerald-700" : "opacity-60"
                      }
                    >
                      {working.has(cat.key)
                        ? t("book.working")
                        : t("book.left", { date: day(cat.last_seen) })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-xs">{t("book.empty")}</p>
          )}
        </section>
      ) : null}
    </>
  )
}
