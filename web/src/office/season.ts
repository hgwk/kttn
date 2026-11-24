import { useEffect, useState } from "react"

// 계절과 시간대. 이 컴퓨터 시각으로 12월에는 창밖에 눈이 내리고 정문 옆에
// 크리스마스트리가 서며, 새벽(0시~5시)에는 사무실 조명이 어두워진다. 실제
// 날씨는 보지 않는다. 주소에 ?season=december나 ?dawn=1을 붙이면 그 모습을
// 미리 볼 수 있다.

export type Season = { december: boolean; dawn: boolean }

const DAWN_FROM = 0
const DAWN_UNTIL = 5

/** 그 시각의 계절과 시간대(주소의 미리 보기 값이 있으면 그것을 따른다) */
export function seasonAt(date: Date, search = ""): Season {
  const params = new URLSearchParams(search)
  const hour = date.getHours()
  return {
    december: params.get("season") === "december" || date.getMonth() === 11,
    dawn:
      params.get("dawn") === "1" || (hour >= DAWN_FROM && hour < DAWN_UNTIL),
  }
}

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
