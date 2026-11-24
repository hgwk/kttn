import type { CSSProperties, ReactNode } from "react"

import { DoorProp, WallDecor } from "@/office/wall-decor"
import { type Floor, TILE } from "@/office/sprites"
import { cn } from "@/lib/utils"

// 위에서 내려다본 건물 벽 윗면과 칸막이 판.
const WALL_TOP = "#8f9e91"
const PARTITION = "#d9dde3"
// 벽·칸막이 두께. 캔버스 픽셀 두 칸(화면 4px)이다.
const WALL = 4

// 복도 바닥(sprite-data.ts의 hallFloor, 14×14를 두 배로 깐다). 방향이 없어
// 가로 복도와, 문에서 내려와 ㄱ자로 이어지는 세로 복도에 같은 타일을 쓴다.
const CORRIDOR_STYLE = {
  backgroundImage: `url("${TILE.hallFloor}")`,
  backgroundSize: "28px 28px",
}
const CorridorUp = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute left-3 w-8 border-x-2 border-[#2b2a36]",
      className
    )}
    style={CORRIDOR_STYLE}
  />
)

// 칸막이 둘레를 집사가 지나가지 못하게 막는 보이지 않는 벽. 위쪽 문
// (left 18px, 폭 32px) 자리만 비운다.
const WALL_RING = 8
function PartitionWalls() {
  const walls: CSSProperties[] = [
    { top: -2, left: -2, width: 20, height: WALL_RING },
    { top: -2, left: 50, right: -2, height: WALL_RING },
    { top: -2, bottom: -2, left: -2, width: WALL_RING },
    { top: -2, bottom: -2, right: -2, width: WALL_RING },
    { bottom: -2, left: -2, right: -2, height: WALL_RING },
  ]
  return walls.map((style, index) => (
    <span
      key={index}
      aria-hidden="true"
      data-obstacle=""
      className="pointer-events-none absolute"
      style={style}
    />
  ))
}

/**
 * 픽셀 방 틀. 바깥 방(building)은 건물 벽을 두르고 위쪽 벽면에 이름표를
 * 달며 아래 벽에 정문을 낸다. 안쪽 방(partition)은 칸막이로 막고 위쪽
 * 칸막이에 문을 내어 바깥 방의 복도와 이어진다. 안쪽 방(wing)이 있으면 책상
 * 구역 아래로 복도를 깔고 그 아래에 칸막이 방들을 나란히 둔다.
 */
export function RoomFrame({
  id,
  label,
  title,
  ariaLabel,
  floor = "wood",
  kind = "partition",
  alert = false,
  tags,
  wing,
  className,
  width,
  deskWidth,
  lounge,
  corridor = true,
  children,
}: {
  id?: string
  label: string
  /** 줄인 이름표에 마우스를 올리면 보이는 전체 이름 */
  title?: string
  ariaLabel: string
  floor?: Floor
  kind?: "building" | "partition"
  alert?: boolean
  tags?: ReactNode
  /** 복도 아래로 늘어서는 칸막이 방들. */
  wing?: ReactNode
  className?: string
  /** 방 바깥 폭(px). 계산해 둔 배치가 있을 때 쓴다(room-plan.ts). */
  width?: number
  /** 안쪽 방으로 가는 복도를 까는지. 방이 하나뿐인 건물은 문 바로 아래에 둔다. */
  corridor?: boolean
  /** 책상 구역 아래 남는 바닥에 놓는 휴게 공간 */
  lounge?: ReactNode
  /** 책상 구역이 바라는 너비(px). 남는 자리에 날개가 선다. */
  deskWidth?: number
  children?: ReactNode
}) {
  const building = kind === "building"
  const floorStyle = {
    backgroundImage: `url("${TILE[floor]}")`,
    // 바닥 타일은 64×32 격자를 두 배로 깐다.
    backgroundSize: "128px 64px",
  }
  const plate = (
    <>
      <span
        title={title}
        className={cn(
          "truncate bg-[#2b2a36] px-1.5 py-px text-xs text-[#f7f2e8]",
          // 건물 이름표는 벽 장식에 밀려 줄지 않는다. 넘치는 장식이 잘린다.
          building && "shrink-0"
        )}
      >
        {label}
      </span>
      {tags}
    </>
  )
  const frame = (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        "relative flex scroll-mt-4 flex-col border-2 border-[#2b2a36] [image-rendering:pixelated]",
        // 건물은 카메라 틀(data-floor) 안에서 통째로 움직인다. 틀보다 작으면
        // 틀을 채우고, 크면 내용만큼 넓어진다(grid 칸이 늘린다).
        building
          ? "shadow-[4px_4px_0_rgba(43,42,54,0.3)]"
          : "max-w-full min-w-0",
        alert && "outline-2 outline-offset-0 outline-amber-400",
        className
      )}
      style={{
        backgroundColor: building ? WALL_TOP : PARTITION,
        padding: WALL,
        width,
      }}
    >
      <div
        className="flex min-h-0 min-w-0 grow flex-col border-2 border-[#2b2a36]"
        style={floorStyle}
      >
        {building ? (
          <div
            data-obstacle=""
            // 정문(left 18~50px) 바로 옆에 외투 걸이판과 우산꽂이를 두고 이름표는 그 오른쪽에 붙인다.
            // 벽 장식은 넓은 건물도 덮도록 길게 되풀이하므로, 그 길이가 건물 폭을
            // 늘리지 않게 이 줄의 가로 크기는 내용과 떼어 놓는다(contain).
            className="relative flex h-8 items-center gap-1.5 overflow-hidden border-b-2 border-[#2b2a36] pr-2 pl-[108px] [contain:inline-size]"
            style={{
              backgroundImage: `url("${TILE.wall}")`,
              backgroundSize: "64px 32px",
            }}
          >
            <DoorProp className="absolute inset-y-0 left-[54px]" />
            {plate}
            <WallDecor />
          </div>
        ) : (
          // 칸막이 방 문패. 위쪽 문 오른쪽 옆에 붙고, 복도가 있으면 문에서
          // 가로 복도까지 세로 복도가 내려온다.
          <div className="relative flex items-center gap-1.5 pt-1.5 pr-2 pl-12">
            {wing ? <CorridorUp className="top-0 -bottom-0.5 z-10" /> : null}
            {plate}
          </div>
        )}
        {/* 안쪽 방이 있으면 문패 아래 복도를 깔고, 그 아래에 이 방의 책상
            구역과 안쪽 방들을 칸처럼 늘어놓는다(배치는 room-plan.ts가 계산한
            방 폭으로 브라우저가 줄을 바꾼다). 왼쪽은 문에서 복도로 오가는
            통로로 비운다. */}
        <div className="flex grow flex-col">
          {/* 건물은 내용이 오른쪽으로 넓어져도 복도가 끝까지 이어지게 감싼다. */}
          <div
            className={cn("flex grow flex-col", building && "w-max min-w-full")}
          >
            {wing && corridor ? (
              <div
                aria-hidden="true"
                className="h-8 shrink-0 border-y-2 border-[#2b2a36]"
                style={CORRIDOR_STYLE}
              />
            ) : null}
            <div
              className={cn(
                // 방이 늘어나면(건물 바로 안의 사무실) 줄도 늘어나 남는 바닥을
                // 책상 구역·안쪽 방 아래 휴게 공간이 채운다.
                "flex grow content-stretch items-start gap-3",
                // 건물은 줄을 바꾸지 않고 오른쪽으로 늘어서며 가로로 스크롤된다.
                // 건물 바로 안의 사무실은 바닥 아래까지 늘인다(줌을 줄여도
                // 아래에 빈 바닥이 남지 않는다).
                building
                  ? "w-max grow flex-nowrap [&>section]:self-stretch"
                  : "flex-wrap",
                // 왼쪽은 세로 복도. 모든 줄의 방이 복도에 닿는다.
                wing && (corridor ? "relative pr-2 pb-3 pl-11" : "p-2")
              )}
            >
              {wing && corridor ? (
                <CorridorUp className="-top-0.5 bottom-0" />
              ) : null}
              {children ? (
                // 같은 줄의 큰 방만큼 아래로 늘어나고, 남는 바닥은 휴게 공간(lounge)이 채운다.
                <div
                  className="flex flex-none flex-col gap-3 self-stretch p-2"
                  style={{ width: deskWidth ? deskWidth + 16 : undefined }}
                >
                  {children}
                  {lounge}
                </div>
              ) : null}
              {wing}
            </div>
          </div>
        </div>
      </div>
      {/* 문. 건물 정문도 칸막이 방 문처럼 위쪽에 낸다.
          방 바닥이 벽 밖까지 이어지고 양옆에 문틀이 선다. */}
      {building ? null : <PartitionWalls />}
      <span
        aria-hidden="true"
        data-door={building ? "" : undefined}
        className="absolute left-[18px] w-8 border-x-2 border-[#2b2a36]"
        style={{
          ...floorStyle,
          top: -2,
          // 건물 정문은 위쪽 벽면(높이 32px+아래 테두리)까지 뚫는다.
          height: building ? WALL + 4 + 34 : WALL + 4,
        }}
      />
    </section>
  )
  if (!building) return frame
  // 건물은 바깥 카메라 틀(data-floor) 안에서 벽·이름표·문째로 스크롤된다.
  // 방 안에서 방이 움직여 보이지 않게, 움직이는 것은 늘 건물 전체다. 집사도
  // 이 틀 안을 걷는다(butler-walk.ts).
  return (
    // TV처럼 얇은 화면 틀. 아래 테두리만 조금 두껍게 하고 전원 불(도트 3×2)을 둔다.
    <div className="relative flex min-h-0 min-w-0 grow border-4 border-b-[10px] border-[#2b2a36]">
      <div
        data-floor={label}
        className="relative grid min-h-0 min-w-0 grow [scrollbar-width:thin] [scrollbar-color:#2b2a36_transparent] overflow-auto overscroll-contain"
      >
        {frame}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 -bottom-[7px] h-[4px] w-[6px] bg-[#4caf5f]"
      />
    </div>
  )
}
