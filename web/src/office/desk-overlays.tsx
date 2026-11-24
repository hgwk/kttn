import type { RefObject } from "react"

import { CatDesk, CatMessage } from "@/office/cat-actions"
import { useCatNames } from "@/office/cat-names"
import { CatSpeech } from "@/office/cat-speech"
import { DeskTag } from "@/office/desk-tag"
import { CAT_DX, officeLayout, seatFor } from "@/office/office-draw"
import type { SessionAgent } from "@/lib/agent-office"
import type { Spots } from "@/office/use-tower"
import { VisitCats } from "@/office/visit-cats"

/**
 * 책상 구역 캔버스 위에 얹는 것들: 고양이 대사 상자, 누를 수 있는 책상 자리,
 * 책상 앞 이름표. 캔버스 좌표를 백분율로 바꿔 캔버스와 함께 늘고 준다.
 */
export function DeskOverlays({
  agents,
  layout,
  now,
  levelUps,
  tower,
  strollers,
  speechRefs,
}: {
  /** 자리에 앉은 고양이(MAX_DESKS 이하) */
  agents: SessionAgent[]
  layout: ReturnType<typeof officeLayout>
  now: number
  levelUps: Set<string>
  tower: Spots
  /** 산책 중인 세션 키를 줄바꿈으로 이은 것 */
  strollers: string
  /** 세션 키별 대사 상자. 걷는 고양이를 따라 옮길 때 쓴다. */
  speechRefs: RefObject<Map<string, HTMLDivElement>>
}) {
  const names = useCatNames()
  return (
    <>
    <VisitCats agents={agents} now={now} nearby={tower} layout={layout} />
    {agents.map((agent, index) => {
      const seat = seatFor(layout, index)
      return (
        <div
          key={`speech-${agent.key}`}
          // 캔버스 루프가 걷는 고양이를 따라 이 상자를 옮긴다(office-canvas.tsx).
          ref={(el) => {
            if (el) speechRefs.current.set(agent.key, el)
            else speechRefs.current.delete(agent.key)
          }}
          // 대사 상자는 집사(z-30)보다 위에 둔다. 집사가 옆에 서면(data-near)
          // 다른 상자들보다도 앞으로 나와 잘린 줄을 다 펼친다. 폭은 그대로 두어
          // 바닥 끝 밖으로 나가지 않고 위로만 길어진다.
          data-cat-speech=""
          // 확인이 필요한 고양이. 화면 밖이면 그쪽 화살표가 깜빡인다(scroll-hint.tsx).
          data-alert={agent.state === "needs_you" ? "" : undefined}
          className="group/speech absolute z-40 w-max max-w-[180px] -translate-x-1/2 -translate-y-full has-[form]:z-[60] data-near:z-50"
          style={{
            left: `${((seat.x + CAT_DX) / layout.w) * 100}%`,
            top: `${((seat.y - 14) / layout.h) * 100}%`,
          }}
        >
          <CatMessage
            agent={agent}
            name={names.get(agent.key) ?? agent.sessionShort}
          >
            <CatSpeech
              agent={agent}
              now={now}
              levelUp={levelUps.has(agent.key)}
              tower={tower}
              mates={agents}
              strolling={strollers.split("\n").includes(agent.key)}
            />
          </CatMessage>
        </div>
      )
    })}
    {/* 책상·의자·고양이 자리. 집사가 지나가지 못하고, 누르면 집사가 간다. */}
    {agents.map((agent, index) => {
      const seat = seatFor(layout, index)
      return (
        <CatDesk
          key={`desk-${agent.key}`}
          agentKey={agent.key}
          name={names.get(agent.key) ?? agent.sessionShort}
          style={{
            left: `${((seat.x - 16) / layout.w) * 100}%`,
            top: `${((seat.y - 8) / layout.h) * 100}%`,
            width: `${(32 / layout.w) * 100}%`,
            height: `${(26 / layout.h) * 100}%`,
          }}
        />
      )
    })}
    {agents.map((agent, index) => (
      <DeskTag
        key={agent.key}
        agent={agent}
        name={names.get(agent.key) ?? agent.sessionShort}
        layout={layout}
        index={index}
      />
    ))}
    </>
  )
}
