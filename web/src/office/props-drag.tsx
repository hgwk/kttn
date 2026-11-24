import {
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

// 사무실 소품(휴게 공간 가구, 위쪽 벽 장식)을 마우스로 옮긴다. 옮긴 자리는
// 기본 자리에서 얼마나 떨어졌는지(px)로 kttn 설정 파일에 남는다(/api/props).
// 서버에 그 주소가 없으면 이 화면을 연 동안만 기억한다.
//   소품은 가장 가까운 [data-move-bounds] 칸을 벗어나지 않고, 도트 두 칸(4px)
//   격자에 맞춰 놓인다. 두 번 누르면 기본 자리로 돌아간다. 집사 길(data-obstacle)은
//   화면에서 다시 읽으므로 옮긴 자리를 알아서 피한다.

type Offset = { x: number; y: number }
type Rooms = Record<string, Record<string, Offset>>

const GRID = 4
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

function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void fetch("/api/props", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rooms }),
    }).catch(() => {})
  }, SAVE_DELAY_MS)
}

function setOffset(room: string, item: string, offset: Offset | null) {
  const next = { ...(rooms[room] ?? {}) }
  if (offset && (offset.x || offset.y)) next[item] = offset
  else delete next[item]
  rooms = { ...rooms, [room]: next }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void load()
  return () => listeners.delete(listener)
}

const snap = (value: number) => Math.round(value / GRID) * GRID
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
  children,
}: {
  room: string
  item: string
  axis?: "xy" | "x"
  className?: string
  children: ReactNode
}) {
  const offset = useSyncExternalStore(
    subscribe,
    () => rooms[room]?.[item],
    () => undefined
  )
  const drag = useRef<{
    px: number
    py: number
    ox: number
    oy: number
    ratio: number
    lo: Offset
    hi: Offset
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
    drag.current = {
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
    setOffset(room, item, { x, y })
  }

  const up = () => {
    if (!drag.current) return
    drag.current = null
    save()
  }

  return (
    <span
      className={className}
      title="끌어서 옮기기 · 두 번 누르면 제자리"
      style={{
        display: "block",
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
