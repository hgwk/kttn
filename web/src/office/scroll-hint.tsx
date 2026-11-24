import { t } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import { PixelIcon } from "@/office/pixel-icon"

// 화면 가장자리에서 이만큼 안쪽까지 들어와야 보이는 것으로 친다.
const EDGE = 40
// 이만큼 넘게 가려져야 화살표를 띄운다. 방 테두리 몇 px가 넘친 것으로는 띄우지 않는다.
const HIDDEN = 16

/**
 * 건물 바닥([data-floor])이 옆이나 위아래로 더 이어질 때 그쪽 가장자리에
 * 화살표를 띄운다. 잘린 게 아니라 스크롤로 이어진다는 표시다. 누르면 그쪽으로
 * 화면의 80%만큼 옮긴다.
 */
export function ScrollHint() {
  const boxRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
  })
  // 확인이 필요한 고양이가 화면 밖 어느 쪽에 있는지
  const [alert, setAlert] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
  })

  useEffect(() => {
    const floor =
      boxRef.current?.parentElement?.querySelector<HTMLElement>("[data-floor]")
    if (!floor) return
    const check = () => {
      const maxX = floor.scrollWidth - floor.clientWidth
      const maxY = floor.scrollHeight - floor.clientHeight
      setEdge({
        left: floor.scrollLeft > HIDDEN,
        right: floor.scrollLeft < maxX - HIDDEN,
        up: floor.scrollTop > HIDDEN,
        down: floor.scrollTop < maxY - HIDDEN,
      })
      const view = floor.getBoundingClientRect()
      const away = { left: false, right: false, up: false, down: false }
      for (const box of floor.querySelectorAll("[data-alert]")) {
        // 가장자리에 걸쳐 끝만 보이는 것도 화면 밖으로 친다(가운데가 40px 안쪽까지 들어와야 보인다).
        const r = box.getBoundingClientRect()
        const x = (r.left + r.right) / 2
        const y = (r.top + r.bottom) / 2
        if (x < view.left + EDGE) away.left = true
        if (x > view.right - EDGE) away.right = true
        if (y < view.top + EDGE) away.up = true
        if (y > view.bottom - EDGE) away.down = true
      }
      setAlert((old) =>
        old.left === away.left &&
        old.right === away.right &&
        old.up === away.up &&
        old.down === away.down
          ? old
          : away
      )
    }
    check()
    // 고양이 상태는 2초마다 바뀌므로 스크롤이 없어도 다시 본다.
    const timer = window.setInterval(check, 1000)
    floor.addEventListener("scroll", check, { passive: true })
    const observer = new ResizeObserver(check)
    observer.observe(floor)
    if (floor.firstElementChild) observer.observe(floor.firstElementChild)
    return () => {
      window.clearInterval(timer)
      floor.removeEventListener("scroll", check)
      observer.disconnect()
    }
  }, [])

  const move = (dx: number, dy: number) => {
    const floor =
      boxRef.current?.parentElement?.querySelector<HTMLElement>("[data-floor]")
    floor?.scrollBy({
      left: dx * floor.clientWidth * 0.8,
      top: dy * floor.clientHeight * 0.8,
      behavior: "smooth",
    })
  }

  const button = "absolute z-40 border-2 border-[#2b2a36] p-1"
  // 그쪽에 확인이 필요한 고양이가 있으면 주황으로 깜빡인다. 클래스 이름 바로
  // 뒤에 ${...}를 붙여 쓰면 Tailwind가 그 클래스를 못 읽으므로 띄어 쓴다.
  // 평소 화살표는 반투명한 어두운 칸에 밝은 화살표로 띄운다. 밝은 바닥에서도
  // 눈에 띄면서 뒤에 가린 고양이·이름표가 비쳐 보인다(옆 화살표가 가장자리
  // 자리의 고양이 머리에 겹치곤 한다). 마우스를 올리거나 키보드로 가면 진해진다.
  const warn = (on: boolean) =>
    on
      ? "bg-amber-400 text-[#2b2a36] hover:bg-amber-300 animate-pulse motion-reduce:animate-none"
      : "bg-[#2b2a36]/45 text-[#f7f2e8] hover:bg-[#2b2a36] focus-visible:bg-[#2b2a36]"
  // 옆 화살표는 아래쪽에 둔다. 가운데 높이는 책상·이름표 줄과 자주 겹친다.
  const side = `${button} bottom-12`
  const end = `${button} left-1/2 -translate-x-1/2`
  return (
    <div ref={boxRef} className="contents">
      {edge.left ? (
        <button
          type="button"
          aria-label={alert.left ? t("scroll.alert", { where: t("scroll.left") }) : t("scroll.left")}
          className={`${side} left-3 ${warn(alert.left)}`}
          onClick={() => move(-1, 0)}
        >
          <span className="block -scale-x-100">
            <PixelIcon name="arrow" />
          </span>
        </button>
      ) : null}
      {edge.right ? (
        <button
          type="button"
          aria-label={alert.right ? t("scroll.alert", { where: t("scroll.right") }) : t("scroll.right")}
          className={`${side} right-3 ${warn(alert.right)}`}
          onClick={() => move(1, 0)}
        >
          <PixelIcon name="arrow" />
        </button>
      ) : null}
      {edge.up ? (
        <button
          type="button"
          aria-label={alert.up ? t("scroll.alert", { where: t("scroll.up") }) : t("scroll.up")}
          className={`${end} top-3 ${warn(alert.up)}`}
          onClick={() => move(0, -1)}
        >
          <span className="block -rotate-90">
            <PixelIcon name="arrow" />
          </span>
        </button>
      ) : null}
      {edge.down ? (
        <button
          type="button"
          aria-label={alert.down ? t("scroll.alert", { where: t("scroll.down") }) : t("scroll.down")}
          className={`${end} bottom-3 ${warn(alert.down)}`}
          onClick={() => move(0, 1)}
        >
          <span className="block rotate-90">
            <PixelIcon name="arrow" />
          </span>
        </button>
      ) : null}
    </div>
  )
}
