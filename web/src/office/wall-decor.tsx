// 건물 벽의 장식과 정문 옆 소품. 창밖 낮밤과 벽시계는 이 컴퓨터 시각을 따른다.
import { useEffect, useMemo, useState } from "react"

import { Prop, type DoorItem, type HangItem } from "@/office/lounge"
import { clockAt } from "@/office/sprite-data"
import { cn } from "@/lib/utils"
import { Movable } from "@/office/props-drag"
import { useSeason } from "@/office/season"
import { Snow } from "@/office/snow"

// 벽 장식 줄을 되풀이하는 횟수. 한 줄이 1,000px 남짓이라 아주 넓은 건물까지 덮는다.
const DECOR_REPEAT = 5
// 건물 위쪽 벽면(32px)에 거는 장식. 벽면 높이에 들어가는 것만 고른다.
// 창문 사이사이에 걸어, 쉬는 고양이가 돌아앉아 창밖을 본다(idleActivity의 window).
const WALL_DECOR: HangItem[] = [
  "window",
  "clock",
  "corkboard",
  "poster",
  "window",
  "wallTV",
  "airConditioner",
  "window",
]

/** 건물 정문 옆 소품. 외투 걸이판은 벽에 걸고 우산꽂이는 그 옆 바닥에 세운다. */
export function DoorProp({ className }: { className?: string }) {
  const hooks: DoorItem = "wallHooks"
  const stand: DoorItem = "umbrellaStand"
  return (
    <span
      aria-hidden="true"
      className={cn("flex items-center gap-1", className)}
    >
      <Prop name={hooks} wall />
      <span className="self-end">
        <Prop name={stand} wall />
      </span>
    </span>
  )
}

// 이 컴퓨터 시각으로 이 시간대(19시~다음 날 6시 전)에는 창밖이 밤하늘이다.
const NIGHT_FROM = 19
const NIGHT_UNTIL = 6
function localTime(date = new Date()) {
  return { hours: date.getHours(), minutes: date.getMinutes() }
}

/** 건물 위쪽 벽면 장식. 이름표 뒤로 일정한 간격을 두고 건다. */
export function WallDecor() {
  // 서버 그림과 어긋나지 않게 처음에는 낮 창·3시 시계로 그리고, 화면이 뜬
  // 뒤 시계를 보고 1분마다 창밖 낮밤과 시곗바늘을 다시 그린다.
  const [time, setTime] = useState<{ hours: number; minutes: number }>()
  useEffect(() => {
    const check = () => setTime(localTime())
    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const { december } = useSeason()
  const night =
    time !== undefined && (time.hours >= NIGHT_FROM || time.hours < NIGHT_UNTIL)
  const clock = useMemo(
    () => (time ? clockAt(time.hours, time.minutes) : undefined),
    [time]
  )
  return (
    <div className="ml-10 flex items-center gap-24">
      {/* 12월에는 벽 장식 줄 맨 앞에 크리스마스트리를 세운다(season.ts). */}
      {december ? <Prop name="christmasTree" wall /> : null}
      {/* 건물이 통째로 스크롤되므로 넓은 건물의 오른쪽 벽도 비지 않게 몇 번
          되풀이해 건다(벽면이 넘치는 만큼은 잘린다). */}
      {Array.from({ length: DECOR_REPEAT }, () => WALL_DECOR)
        .flat()
        .map((name, index) => (
          // 벽 띠 안에서 좌우로만 옮길 수 있다(props-drag.tsx).
          <Movable
            key={`${name}-${index}`}
            room="wall"
            item={`decor:${index}:${name}`}
            axis="x"
          >
            <span className="relative block">
              <Prop
                name={name === "window" && night ? "windowNight" : name}
                grid={name === "clock" ? clock : undefined}
                wall
              />
              {/* 12월에는 창밖에 눈이 내린다(season.ts). 되풀이한 줄은 벽면
                  밖으로 잘려 안 보이므로 첫 줄의 창에만 내린다. */}
              {name === "window" && december && index < WALL_DECOR.length ? (
                <Snow />
              ) : null}
            </span>
          </Movable>
        ))}
    </div>
  )
}
