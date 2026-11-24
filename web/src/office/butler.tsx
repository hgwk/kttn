import { useEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"

import { ButlerFigure } from "@/office/butler-figure"

import {
  MOVE_KEYS,
  SIZE,
  STEP_MS,
  TAP_S,
  WALK_SPEED,
  facing,
  focusSession,
  nearestSpeech,
  sheet,
  typing,
  type Dir,
} from "@/office/butler-controls"
import {
  boxIn,
  canStand,
  doorSpot,
  findPath,
  OBSTACLE_PAD_BELOW,
  readWalkMap,
  stepRoute,
} from "@/office/butler-walk"

/**
 * 사용자 캐릭터 '집사'. 방향키·WASD로 건물 벽 안쪽 바닥을 걸어 다닌다. 책상과
 * 칸막이에는 막히고 칸막이 방은 문으로 드나든다(butler-walk.ts). 집사는
 * 바닥(스크롤 영역) 안에 그려져 바닥과 함께 스크롤되고, 걸으면 바닥 스크롤이
 * 집사를 따라간다. 처음에는 건물 정문 안쪽에 선다. 좌표는 바닥 안쪽(줄이기
 * 전) 기준이다.
 */
export function Butler({
  stageRef,
  scale,
  scene,
}: {
  /** 건물 바닥([data-floor])을 찾을 무대 안쪽 */
  stageRef: RefObject<HTMLDivElement | null>
  scale: number
  scene: string
}) {
  const [floor, setFloor] = useState<HTMLElement | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sayRef = useRef<HTMLSpanElement>(null)
  const latest = useRef({ scale })
  useEffect(() => {
    latest.current = { scale }
  })

  // 건물이 바뀌면(처음 그릴 때 포함) 그 건물의 바닥을 찾는다.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setFloor(
        stageRef.current?.querySelector<HTMLElement>("[data-floor]") ?? null
      )
    )
    return () => cancelAnimationFrame(id)
  }, [stageRef, scene])

  useEffect(() => {
    const box = boxRef.current
    const ctx = canvasRef.current?.getContext("2d")
    if (!floor || !box || !ctx) return
    const frames = sheet()
    const pos = { x: -100, y: -100 }
    let dir: Dir = "back"
    let walkedMs = 0
    let walking = false
    const held = new Set<string>()
    // 한 프레임도 지나기 전에 뗀 키. 짧게 톡 눌러도 한 걸음은 걷는다.
    const tapped = new Set<string>()
    let frame = 0
    let last = 0
    const map = () => readWalkMap(floor, latest.current.scale)
    // 고양이를 누르면 그 책상 앞까지 걸어갈 길과, 도착해서 할 일.
    let route: { x: number; y: number }[] = []
    let reroutes = 0
    let arrive: (() => void) | null = null
    const bubble = sayRef.current
    let labelTimer = 0
    // 머리 위에 잠깐 말한다(탭을 열었는지·못 열었는지). 이름표는 그대로 둔다.
    const say = (text: string) => {
      if (!bubble) return
      bubble.textContent = text
      bubble.hidden = false
      window.clearTimeout(labelTimer)
      labelTimer = window.setTimeout(() => {
        bubble.hidden = true
      }, 3000)
    }

    const draw = () => {
      const row = dir === "front" ? 0 : dir === "back" ? 1 : 2
      const col = walking ? Math.floor(walkedMs / STEP_MS) % 4 : 0
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, 16, 16)
      ctx.save()
      if (dir === "left") {
        ctx.translate(16, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(frames, col * 16, row * 16, 16, 16, 0, 0, 16, 16)
      ctx.restore()
      box.style.transform = `translate(${Math.round(pos.x - SIZE / 2)}px, ${Math.round(pos.y - SIZE)}px)`
    }

    // 바닥 스크롤을 옮겨 집사를 보이는 곳 가운데 쪽에 둔다. 끝을 넘는 값은
    // 브라우저가 잘라 준다. jump면 바로, 아니면 부드럽게 따라간다.
    const follow = (jump: boolean) => {
      const k = jump ? 1 : 0.18
      const x = pos.x - floor.clientWidth / 2
      const y = pos.y - SIZE / 2 - floor.clientHeight / 2
      floor.scrollLeft += (x - floor.scrollLeft) * k
      floor.scrollTop += (y - floor.scrollTop) * k
    }

    // 가장 가까운 고양이 하나의 대사 상자에 data-near를 단다. 상자 아래 끝이
    // 고양이 머리라 그보다 조금 아래를 고양이 자리로 본다.
    let near: Element | null = null
    const findNear = () => {
      const best = nearestSpeech(floor, pos, latest.current.scale)
      if (best === near) return
      near?.removeAttribute("data-near")
      best?.setAttribute("data-near", "")
      near = best
    }

    // 정문에 세운 뒤 아직 걷지 않았는지. 그동안은 배치가 바뀌어도 정문에 다시 세운다.
    let atDoor = false
    // 정문 안쪽에 세운다. focus면 바닥 스크롤도 그쪽으로 옮긴다.
    const spawn = (focus: boolean) => {
      const spot = doorSpot(map())
      pos.x = spot.x
      pos.y = spot.y
      dir = "back"
      atDoor = true
      draw()
      if (focus) follow(true)
      findNear()
    }
    spawn(true)
    const born = performance.now()

    // 바닥 크기가 바뀌었을 때 아직 정문에서 걷지 않았거나, 배치가 바뀌어 설
    // 수 없는 곳(바닥 밖·책상 위)에 남았으면 정문 안쪽으로 옮긴다. 화면은 처음
    // 자리 잡는 동안(2초)만 집사 쪽으로 옮긴다. 그 뒤에 크기가 바뀔 때마다
    // 옮기면 사용자가 스크롤해 둔 곳이 자꾸 원점(정문)으로 돌아간다.
    const resized = new ResizeObserver(() => {
      if (atDoor || !canStand(map(), pos.x, pos.y))
        spawn(atDoor && performance.now() - born < 2000)
    })
    resized.observe(floor)
    if (floor.firstElementChild) resized.observe(floor.firstElementChild)

    const tick = (now: number) => {
      // 첫 프레임은 지난 시각이 없으므로 한 걸음(TAP_S)만큼 걷는다.
      const dt = last ? Math.min(0.05, (now - last) / 1000) : TAP_S
      last = now
      let dx = 0
      let dy = 0
      for (const key of new Set([...held, ...tapped])) {
        dx += MOVE_KEYS[key][0]
        dy += MOVE_KEYS[key][1]
      }
      // 고양이에게 가는 길이 있으면 다음 점 쪽으로 걷는다. 그사이 길이 막히면
      // 다시 찾는다(butler-walk.ts의 stepRoute).
      if (route.length && !dx && !dy) {
        const next = route[0]
        // 다시 찾은 길의 첫 걸음도 막혀 제자리에서 맴돌면 거기서 멈춘다.
        const again = stepRoute(map(), pos, route, WALK_SPEED * dt)
        reroutes = again ? reroutes + 1 : 0
        if (reroutes > 3) route = []
        dir = facing(pos, next)
        walking = true
        walkedMs += dt * 1000
        atDoor = false
        follow(false)
        findNear()
        if (!route.length) {
          dir = "back"
          arrive?.()
          arrive = null
        }
        tapped.clear()
        draw()
        frame = requestAnimationFrame(tick)
        if (!route.length && !held.size) {
          cancelAnimationFrame(frame)
          frame = 0
          last = 0
          walking = false
          draw()
        }
        return
      }
      walking = dx !== 0 || dy !== 0
      if (walking) {
        if (dx !== 0) dir = dx < 0 ? "left" : "right"
        else dir = dy < 0 ? "back" : "front"
        const len = Math.hypot(dx, dy)
        const step = WALK_SPEED * dt
        const walk = map()
        // 축마다 따로 움직여 벽을 따라 미끄러지게 한다. 옮긴 소품에 깔려 이미
        // 설 수 없는 자리에 있으면 막지 않아 걸어 나올 수 있게 한다.
        const stuck = !canStand(walk, pos.x, pos.y)
        const nx = pos.x + (dx / len) * step
        if (stuck || canStand(walk, nx, pos.y)) pos.x = nx
        const ny = pos.y + (dy / len) * step
        if (stuck || canStand(walk, pos.x, ny)) pos.y = ny
        walkedMs += dt * 1000
        atDoor = false
        follow(false)
        findNear()
      }
      tapped.clear()
      draw()
      frame = held.size ? requestAnimationFrame(tick) : 0
      if (!frame) {
        last = 0
        walking = false
        draw()
      }
    }

    const keyName = (event: KeyboardEvent) =>
      event.key.length === 1 ? event.key.toLowerCase() : event.key
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typing(event.target)) return
      const name = keyName(event)
      if (!(name in MOVE_KEYS)) return
      event.preventDefault()
      // 직접 움직이면 고양이에게 가던 길은 그만둔다.
      route = []
      arrive = null
      held.add(name)
      tapped.add(name)
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const up = (event: KeyboardEvent) => held.delete(keyName(event))
    const clear = () => held.clear()
    // 고양이(책상)를 누르면 그 책상 앞으로 걸어가 그 세션의 터미널 탭을 연다
    // (cat-actions.tsx가 보내는 butler:visit). 길이 없으면 바로 연다.
    const openTab = async (key: string) => say(await focusSession(key))
    const visit = (event: Event) => {
      const key = (event as CustomEvent<{ key: string }>).detail?.key
      const desk = [...floor.querySelectorAll<HTMLElement>("[data-desk]")].find(
        (el) => el.dataset.desk === key
      )
      if (!key || !desk) return
      const box = boxIn(desk, floor, latest.current.scale)
      const path = findPath(
        map(),
        pos,
        {
          x: (box.l + box.r) / 2,
          // 책상 아래 여유(OBSTACLE_PAD_BELOW)를 지나 바로 앞.
          y: box.b + OBSTACLE_PAD_BELOW + 8,
        },
        10
      )
      if (!path) {
        void openTab(key)
        return
      }
      route = path
      arrive = () => void openTab(key)
      if (!frame) frame = requestAnimationFrame(tick)
    }
    floor.addEventListener("butler:visit", visit)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    return () => {
      floor.removeEventListener("butler:visit", visit)
      window.clearTimeout(labelTimer)
      resized.disconnect()
      near?.removeAttribute("data-near")
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
    }
  }, [floor])

  if (!floor) return null
  return createPortal(
    <ButlerFigure boxRef={boxRef} canvasRef={canvasRef} sayRef={sayRef} />,
    floor
  )
}
