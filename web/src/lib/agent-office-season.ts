// 계절과 시간대 판정. 이 컴퓨터 시각으로 12월이면 겨울 장식, 0시~5시 전이면
// 새벽 조명이다. 주소의 ?season=december|none, ?dawn=1|0으로 미리 보거나 끈
// 모습을 볼 수 있다(그 밖의 값은 무시한다). 화면은 office/season.ts.

export type Season = { december: boolean; dawn: boolean }

const DAWN_FROM = 0
const DAWN_UNTIL = 5

export function seasonAt(date: Date, search = ""): Season {
  const params = new URLSearchParams(search)
  const season = params.get("season")
  const dawn = params.get("dawn")
  const hour = date.getHours()
  return {
    december:
      season === "december"
        ? true
        : season === "none"
          ? false
          : date.getMonth() === 11,
    dawn:
      dawn === "1"
        ? true
        : dawn === "0"
          ? false
          : hour >= DAWN_FROM && hour < DAWN_UNTIL,
  }
}
