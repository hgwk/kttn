import { useEffect, useRef, useState, type RefObject } from "react"

import type { Nearby } from "@/lib/kttn-acts"

/** 둘레 정보에 찾아갈 소품 요소([data-visit])와 캣타워 요소까지 더한 것 */
export type Spots = Nearby & { spots: HTMLElement[]; towerEl?: HTMLElement }

const NONE: Spots = { tower: false, props: 0, spots: [] }

/**
 * 같은 책상 구역의 휴게 공간에 캣타워와 찾아갈 소품(data-visit)이 있는지.
 * 휴게 공간은 들어갈 자리가 있을 때만 그려지고 소품은 옮기거나 들일 수
 * 있으므로 화면에서 2초마다 확인한다. 그리는 고리에서 읽을 ref도 돌려준다.
 */
export function useTowerNearby(boxRef: RefObject<HTMLElement | null>) {
  const [nearby, setNearby] = useState<Spots>(NONE)
  const nearbyRef = useRef<Spots>(NONE)
  useEffect(() => {
    const check = () => {
      const scope = boxRef.current?.parentElement
      const spots = [
        ...(scope?.querySelectorAll<HTMLElement>("[data-visit]") ?? []),
      ]
      const towerEl =
        scope?.querySelector<HTMLElement>("[data-cat-tower]") ?? undefined
      const tower = Boolean(towerEl)
      const old = nearbyRef.current
      if (
        old.towerEl === towerEl &&
        old.spots.length === spots.length &&
        old.spots.every((el, i) => el === spots[i])
      )
        return
      const next = { tower, props: spots.length, spots, towerEl }
      nearbyRef.current = next
      setNearby(next)
    }
    check()
    const timer = window.setInterval(check, 2000)
    return () => window.clearInterval(timer)
  }, [boxRef])
  return [nearby, nearbyRef] as const
}
