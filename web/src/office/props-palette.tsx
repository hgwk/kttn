import { t } from "@/i18n"
import { useEffect, type DragEvent } from "react"

import { Prop } from "@/office/lounge"
import { OFFICE_SCALE } from "@/office/pixel"
import { PixelIcon } from "@/office/pixel-icon"
import {
  ADDED,
  Movable,
  save,
  setOffset,
  snap,
  useRoomProps,
} from "@/office/props-drag"
import { ITEMS } from "@/office/sprite-data"
import type { ItemName } from "@/office/sprites"

// 월드맵 아래 소품 목록. 끌어서 휴게 공간([data-drop-room])에 놓으면 그 자리에
// 소품이 하나 생긴다. 벽에 거는 장식은 위쪽 벽 띠(room "wall")에만, 나머지는
// 휴게 공간에만 놓인다. 놓인 자리는 옮긴 자리와 같은 설정 파일에 남고
// (열쇠 "add:<id>:<name>", 값은 칸 왼쪽 위에서 잰 자리), 두 번 누르면 치운다.

const HANG: ItemName[] = [
  "window",
  "clock",
  "corkboard",
  "poster",
  "frame",
  "wallTV",
  "airConditioner",
]
const FLOOR: ItemName[] = [
  "bookshelf",
  "lockers",
  "cabinet",
  "vendingMachine",
  "waterCooler",
  "miniFridge",
  "sofa",
  "bench",
  "floorLamp",
  "monstera",
  "plant",
  "cactus",
  "beanBag",
  "heater",
  "fishTank",
  "catBed",
  "scratcher",
  "yarn",
  "box",
  "foodBowl",
  "trash",
]
const MIME = "application/x-kttn-prop"
const WALL_ROOM = "wall"

const size = (name: ItemName) => ({
  w: ITEMS[name][0].length * OFFICE_SCALE,
  h: ITEMS[name].length * OFFICE_SCALE,
})

/** 끌어다 놓은 소품을 그 칸에 놓는다. 놓을 수 없는 칸이면 그냥 둔다. */
function drop(event: globalThis.DragEvent) {
  const raw = event.dataTransfer?.getData(MIME)
  const target = (event.target as Element | null)?.closest<HTMLElement>(
    "[data-drop-room]"
  )
  if (!raw || !target) return
  const name = raw as ItemName
  const room = target.dataset.dropRoom ?? ""
  if (!(name in ITEMS) || HANG.includes(name) !== (room === WALL_ROOM)) return
  event.preventDefault()
  const box = target.getBoundingClientRect()
  const ratio = box.width / (target.offsetWidth || box.width) || 1
  const { w, h } = size(name)
  const fit = (value: number, span: number, room: number) =>
    Math.round(Math.min(Math.max(value, 0), Math.max(0, room - span)))
  const x = fit(
    snap((event.clientX - box.left) / ratio - w / 2),
    w,
    Math.min(target.offsetWidth, 2000)
  )
  // 벽 띠는 높이가 정해져 있어 세로 가운데에 건다.
  const y =
    room === WALL_ROOM
      ? Math.round((target.offsetHeight - h) / 2)
      : fit(snap((event.clientY - box.top) / ratio - h / 2), h, target.offsetHeight)
  setOffset(room, `${ADDED}${Date.now().toString(36)}:${name}`, { x, y })
  save()
}

function over(event: globalThis.DragEvent) {
  if (!event.dataTransfer?.types.includes(MIME)) return
  if ((event.target as Element | null)?.closest("[data-drop-room]"))
    event.preventDefault()
}

/** 월드맵 아래 소품 목록. 소품을 끌어 휴게 공간이나 위쪽 벽에 놓는다. */
export function PropPalette() {
  useEffect(() => {
    document.addEventListener("dragover", over)
    document.addEventListener("drop", drop)
    return () => {
      document.removeEventListener("dragover", over)
      document.removeEventListener("drop", drop)
    }
  }, [])
  const start = (name: ItemName) => (event: DragEvent) => {
    event.dataTransfer.setData(MIME, name)
    event.dataTransfer.effectAllowed = "copy"
  }
  return (
    <section
      aria-labelledby="office-props"
      className="grid content-start gap-1.5"
    >
      <h3
        id="office-props"
        title={t("props.paletteHint")}
        className="inline-flex w-fit items-center gap-1.5 bg-[#2b2a36] px-1.5 py-px text-xs text-[#f7f2e8]"
      >
        <PixelIcon name="plant" />
        {t("props.title")}
      </h3>
      <div className="grid content-start gap-2 border-2 border-[#2b2a36] bg-[#f4efe6] p-2">
        {[
          { label: t("props.wall"), names: HANG },
          { label: t("props.floor"), names: FLOOR },
        ].map((group) => (
          <div key={group.label} className="grid gap-1">
            <p className="text-[10px] text-[#2b2a36]">{group.label}</p>
            <ul className="flex flex-wrap items-end gap-2">
              {group.names.map((name) => (
                <li
                  key={name}
                  draggable
                  onDragStart={start(name)}
                  title={name}
                  className="cursor-grab"
                >
                  <Prop name={name} wall />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 한 칸에 들여온 소품들. 칸 왼쪽 위에서 잰 자리에 놓고, 끌어서 옮긴다. */
export function AddedProps({ room }: { room: string }) {
  const props = useRoomProps(room)
  const keys = Object.keys(props ?? {}).filter((key) => key.startsWith(ADDED))
  return keys.map((key) => {
    const name = key.split(":").at(-1) as ItemName
    if (!(name in ITEMS)) return null
    const hang = HANG.includes(name)
    return (
      <Movable
        key={key}
        room={room}
        item={key}
        axis={hang ? "x" : "xy"}
        className="absolute top-0 left-0 z-10"
        title={t("props.addedHint")}
      >
        <Prop name={name} wall={hang} />
      </Movable>
    )
  })
}
