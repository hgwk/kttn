// 하루 kttn 신문의 기사 거리. 도감 기록(하루 집계 day, 마지막으로 본 날,
// 최고 동시 근무)과 지금 조는 고양이로 정한다. 그림은 kttn/kttn-paper.tsx.

export type PaperCat = {
  key: string
  name: string
  lastSeen: string
  /** 그날의 집계(서버가 주면). date는 이 컴퓨터 날짜(YYYY-MM-DD) */
  day?: { date: string; tools: number; failures: number }
}

export type PaperInput = {
  /** 오늘 날짜(YYYY-MM-DD, 이 컴퓨터) */
  today: string
  cats: PaperCat[]
  /** 지금 조는 고양이들과 졸기 시작한 시각 */
  sleepers: { key: string; name: string; since: string }[]
  peak?: { count: number; at: string }
  now: number
}

export type PaperFacts = {
  /** 오늘 도구를 가장 많이 쓴 고양이(하루 집계가 있을 때) */
  busiest?: { key: string; name: string; tools: number }
  /** 지금 가장 오래 조는 고양이 */
  dozer?: { key: string; name: string; since: string }
  /** 오늘 실패한 도구 수(하루 집계가 있을 때) */
  failures?: number
  /** 오늘 본 고양이 수 */
  cats: number
  peak?: { count: number; at: string }
}

const localDay = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv")
}

export function paperFacts(input: PaperInput): PaperFacts {
  const seen = input.cats.filter(
    (cat) => localDay(cat.lastSeen) === input.today
  )
  const counted = input.cats.filter((cat) => cat.day?.date === input.today)
  let busiest: PaperFacts["busiest"]
  for (const cat of counted) {
    const tools = cat.day?.tools ?? 0
    if (tools > 0 && tools > (busiest?.tools ?? 0))
      busiest = { key: cat.key, name: cat.name, tools }
  }
  let dozer: PaperFacts["dozer"]
  for (const cat of input.sleepers) {
    const since = Date.parse(cat.since)
    if (Number.isNaN(since) || since > input.now) continue
    if (!dozer || since < Date.parse(dozer.since)) dozer = cat
  }
  return {
    busiest,
    dozer,
    failures: counted.length
      ? counted.reduce((sum, cat) => sum + (cat.day?.failures ?? 0), 0)
      : undefined,
    cats: seen.length,
    peak: input.peak,
  }
}
