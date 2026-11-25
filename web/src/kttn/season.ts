import { useEffect, useState } from "react"

import { seasonAt, type Season } from "@/lib/kttn-season"

// 화면의 계절과 시간대(판정은 lib/kttn-season.ts). 12월에는 창밖에 눈이
// 내리고 벽에 크리스마스트리가 서며, 새벽에는 kttn 조명이 어두워진다.

const NONE: Season = { december: false, dawn: false }

/** 지금 계절과 시간대. 1분마다 다시 본다(서버 그림과 맞게 처음에는 없음). */
export function useSeason() {
  const [season, setSeason] = useState<Season>(NONE)
  useEffect(() => {
    const check = () => {
      const next = seasonAt(new Date(), window.location.search)
      setSeason((old) =>
        old.december === next.december && old.dawn === next.dawn ? old : next
      )
    }
    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return season
}
