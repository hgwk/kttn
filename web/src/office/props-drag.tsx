import { t } from "@/i18n"
import {
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { VISIT } from "@/office/props-catalog"
import { GONE, gone, lightTrash, puff, trashAt } from "@/office/props-trash"
import type { ItemName } from "@/office/sprites"

// 사무실 소품(휴게 공간 가구, 위쪽 벽 장식)을 마우스로 옮긴다. 옮긴 자리는
// 기본 자리에서 얼마나 떨어졌는지(px)로 kttn 설정 파일에 남는다(/api/props).
// 서버에 그 주소가 없으면 이 화면을 연 동안만 기억한다.
//   소품은 가장 가까운 [data-move-bounds] 칸을 벗어나지 않고, 도트 네 칸(8px)
//   격자에 맞춰 놓인다. 두 번 누르면 기본 자리로 돌아간다. 집사 길(data-obstacle)은
//   화면에서 다시 읽으므로 옮긴 자리를 알아서 피한다.

type Offset = { x: number; y: number }
type Rooms = Record<string, Record<string, Offset>>

const GRID = 8
const SAVE_DELAY_MS = 300

let rooms: Rooms = {}
let loading: Promise<void> | null = null
let saveTimer = 0
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

function load() {
  loading ??= fetch("/api/props", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { rooms?: Rooms } | null) => {
      if (body?.rooms && typeof body.rooms === "object") {
        rooms = body.rooms
        emit()
      }
    })
    .catch(() => {})
  return loading
}

/** 바뀐 자리를 설정 파일에 남긴다(잠깐 모았다가 한 번에). */
export function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void fetch("/api/props", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rooms }),
    }).catch(() => {})
  }, SAVE_DELAY_MS)
}

/** 팔레트에서 들여온 소품의 열쇠 머리. 값은 칸 왼쪽 위에서 잰 자리다. */
export const ADDED = "add:"

/** 소품 자리를 바꾼다(null이면 지운다). 들여온 소품은 (0, 0)이어도 남긴다. */
export function setOffset(room: string, item: string, offset: Offset | null) {
  const next = { ...(rooms[room] ?? {}) }
  if (offset && (offset.x || offset.y || item.startsWith(ADDED)))
    next[item] = offset
  else delete next[item]
  rooms = { ...rooms, [room]: next }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void load()
  return () => listeners.delete(listener)
}

// 끄는 동안 소품이 움직일 수 있는 칸을 보인다. 반투명 바탕에 도트 여덟 칸(16px)
// 격자를 깔고 테두리를 점선으로 두른다. 소품 아래에 깔리도록 맨 앞에 넣는다.
export function showGuide(bounds: Element) {
  const guide = document.createElement("div")
  guide.setAttribute("aria-hidden", "true")
  Object.assign(guide.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    backgroundColor: "rgba(43, 42, 54, 0.22)",
    backgroundImage:
      "linear-gradient(rgba(247, 242, 232, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(247, 242, 232, 0.25) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
    outline: "2px dashed #fbbf24",
    outlineOffset: "-2px",
  })
  bounds.prepend(guide)
  return guide
}

// 두 화면 자리가 겹치는지. 맞닿기만 한 것은 겹친 것이 아니다.
const hits = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** 한 칸(room)에 놓인 소품 자리들. 바뀔 때마다 다시 그린다. */
export function useRoomProps(room: string) {
  return useSyncExternalStore(
    subscribe,
    () => rooms[room],
    () => undefined
  )
}

export const snap = (value: number) => Math.round(value / GRID) * GRID
// 칸 끝에 닿으면 칸 경계로 붙이되, 서버는 정수만 받으므로 반올림한다.
const clamp = (value: number, lo: number, hi: number) =>
  Math.round(Math.min(Math.max(value, lo), hi))

/**
 * 끌어서 옮길 수 있는 소품 하나. room·item이 저장 열쇠다. axis가 "x"면 좌우로만
 * 움직인다(벽 장식).
 */
export function Movable({
  room,
  item,
  axis = "xy",
  className,
  title,
  children,
}: {
  room: string
  item: string
  axis?: "xy" | "x"
  className?: string
  title?: string
  children: ReactNode
}) {
  const offset = useSyncExternalStore(
    subscribe,
    () => rooms[room]?.[item],
    () => undefined
  )
  const name = item.split(":").at(-1) as ItemName
  const drag = useRef<{
    px: number
    py: number
    ox: number
    oy: number
    ratio: number
    lo: Offset
    hi: Offset
    /** 끌기 시작할 때 이 소품의 화면 자리 */
    rect: DOMRect
    /** 겹치면 안 되는 같은 칸의 다른 소품·낮은 벽(화면 자리) */
    blockers: DOMRect[]
    /** 마지막으로 놓을 수 있던 자리 */
    last: Offset
    /** 끄는 동안 칸 위에 깐 자리 안내 */
    guide: HTMLElement
  } | null>(null)

  const down = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return
    const el = event.currentTarget
    const bounds = el.parentElement?.closest("[data-move-bounds]")
    if (!bounds) return
    event.preventDefault()
    el.setPointerCapture(event.pointerId)
    const box = bounds.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    // 화면 배율(확대·축소). 겉보기 폭과 원래 폭의 비율이다.
    const ratio = rect.width / (el.offsetWidth || rect.width) || 1
    const ox = offset?.x ?? 0
    const oy = offset?.y ?? 0
    // 같은 칸의 다른 소품과 장애물(낮은 벽). 소품 안의 그림은 그 소품으로 센다.
    // 처음부터 겹쳐 있던 것은 빼야 꼼짝 못 하는 일이 없다.
    const blockers = [
      ...bounds.querySelectorAll("[data-movable], [data-obstacle]"),
    ]
      .filter(
        (other) =>
          other !== el &&
          !el.contains(other) &&
          (other.matches("[data-movable]") || !other.closest("[data-movable]"))
      )
      .map((other) => other.getBoundingClientRect())
      .filter((other) => !hits(rect, other))
    drag.current = {
      guide: showGuide(bounds),
      rect,
      blockers,
      last: { x: ox, y: oy },
      px: event.clientX,
      py: event.clientY,
      ox,
      oy,
      ratio,
      lo: {
        x: ox + (box.left - rect.left) / ratio,
        y: oy + (box.top - rect.top) / ratio,
      },
      hi: {
        x: ox + (box.right - rect.right) / ratio,
        y: oy + (box.bottom - rect.bottom) / ratio,
      },
    }
  }

  const move = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const start = drag.current
    if (!start) return
    const el = event.currentTarget
    lightTrash(trashAt(event.clientX, event.clientY, el))
    const x = clamp(
      snap(start.ox + (event.clientX - start.px) / start.ratio),
      start.lo.x,
      start.hi.x
    )
    const y =
      axis === "x"
        ? start.oy
        : clamp(
            snap(start.oy + (event.clientY - start.py) / start.ratio),
            start.lo.y,
            start.hi.y
          )
    // 겹치면 가로나 세로 한쪽으로만 미끄러지고, 둘 다 막히면 제자리에 둔다.
    const free = (at: Offset) => {
      const dx = (at.x - start.ox) * start.ratio
      const dy = (at.y - start.oy) * start.ratio
      const moved = new DOMRect(
        start.rect.x + dx,
        start.rect.y + dy,
        start.rect.width,
        start.rect.height
      )
      return !start.blockers.some((other) => hits(moved, other))
    }
    const next = [
      { x, y },
      { x, y: start.last.y },
      { x: start.last.x, y },
    ].find(free)
    if (!next) return
    start.last = next
    setOffset(room, item, next)
  }

  const up = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return
    drag.current.guide.remove()
    drag.current = null
    lightTrash()
    // 휴지통에 놓으면 치운다(props-trash.ts).
    if (trashAt(event.clientX, event.clientY, event.currentTarget)) {
      puff(event.clientX, event.clientY)
      const off = item.startsWith(ADDED) ? null : { x: GONE, y: GONE }
      setOffset(room, item, off)
    }
    save()
  }

  if (gone(offset)) return null

  return (
    <span
      className={className}
      data-movable=""
      // 쉬는 고양이가 찾아가는 소품이면 거기서 하는 일(visit-cats.tsx)
      data-visit={VISIT[name]}
      data-trash={name === "trash" ? "" : undefined}
      title={title ?? t("props.moveHint")}
      style={{
        display: "block",
        // 찾아온 고양이 그림이 이 소품을 기준으로 놓인다.
        position: className?.includes("absolute") ? undefined : "relative",
        cursor: "grab",
        touchAction: "none",
        transform: offset
          ? `translate(${offset.x}px, ${offset.y}px)`
          : undefined,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => {
        setOffset(room, item, null)
        save()
      }}
    >
      {children}
    </span>
  )
}
