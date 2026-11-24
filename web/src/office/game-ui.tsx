// 육성 시뮬레이션 게임 화면 부품. 창 틀은 8bitcn Card의 픽셀 테두리를 쓰고,
// 상태 막대는 칸을 나눠 채우는 게임식 게이지로 그린다.
import { t } from "@/i18n"
import type { ReactNode } from "react"

import {
  PixelIcon,
  type PixelIconName,
} from "@/office/pixel-icon"
import { Badge } from "@/components/ui/8bit/badge"
import { Card } from "@/components/ui/8bit/card"
import { cn } from "@/lib/utils"

/** 제목 띠가 붙은 게임 창. */
export function GameWindow({
  title,
  extra,
  children,
  className,
  alert = false,
  labelledBy,
}: {
  title: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  alert?: boolean
  labelledBy?: string
}) {
  return (
    <Card
      font="normal"
      className={cn(
        "gap-0 border-[#2b2a36] py-0 dark:border-[#6b6a80]",
        className
      )}
    >
      <section
        aria-labelledby={labelledBy}
        className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]"
      >
        <header
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2 px-3 py-1.5 text-sm",
            alert
              ? "bg-amber-400 text-amber-950"
              : "bg-[#2b2a36] text-[#f7f2e8]"
          )}
        >
          <h2 id={labelledBy} className="truncate text-sm">
            {title}
          </h2>
          {extra ? (
            <div className="ml-auto flex items-center gap-2 text-xs">
              {extra}
            </div>
          ) : null}
        </header>
        <div className="min-h-0 min-w-0 p-3">{children}</div>
      </section>
    </Card>
  )
}

/** 상단 HUD의 칸 하나. 8bitcn Badge의 픽셀 테두리를 쓴다. */
export function HudItem({
  icon,
  label,
  value,
  tone = "plain",
}: {
  icon: PixelIconName
  label: string
  value: ReactNode
  tone?: "plain" | "alert" | "good"
}) {
  return (
    <Badge
      font="normal"
      className={cn(
        "mx-1 h-7 px-2 text-sm",
        tone === "alert"
          ? "animate-pulse bg-amber-400 text-amber-950 motion-reduce:animate-none"
          : tone === "good"
            ? "bg-[#4caf5f] text-white"
            : "bg-[#f7f2e8] text-[#2b2a33]"
      )}
    >
      <PixelIcon name={icon} />
      {label ? <span className="text-xs opacity-80">{label}</span> : null}
      <span className="tabular-nums">{value}</span>
    </Badge>
  )
}

/** 화면 맨 위 상태바. 8bitcn Card 틀 안에 HUD 칸을 늘어놓는다. */
export function Hud({ children }: { children: ReactNode }) {
  return (
    <Card
      font="normal"
      className="border-[#2b2a36] bg-[#2b2a3a] py-0 dark:border-[#6b6a80]"
    >
      <div
        role="status"
        aria-label={t("hud.label")}
        className="flex flex-wrap items-center gap-x-2 gap-y-3 px-3 py-2.5"
      >
        {children}
      </div>
    </Card>
  )
}
