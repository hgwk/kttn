import { useEffect, useRef, useState, type RefObject } from "react"

/**
 * 같은 책상 구역의 휴게 공간에 캣타워가 놓였는지. 휴게 공간은 들어갈 자리가
 * 있을 때만 그려지므로 화면에서 2초마다 확인한다. 그리는 고리에서 읽을 ref도
 * 함께 돌려준다.
 */
export function useTowerNearby(boxRef: RefObject<HTMLElement | null>) {
  const [hasTower, setHasTower] = useState(false)
  const towerRef = useRef(false)
  useEffect(() => {
    const check = () => {
      const found = Boolean(
        boxRef.current?.parentElement?.querySelector("[data-cat-tower]")
      )
      towerRef.current = found
      setHasTower(found)
    }
    check()
    const timer = window.setInterval(check, 2000)
    return () => window.clearInterval(timer)
  }, [boxRef])
  return [hasTower, towerRef] as const
}
