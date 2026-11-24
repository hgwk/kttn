import type { OfficeLayout } from "@/office/office-draw"
import {
  outsideY,
  pathToSeat,
  type DoorSide,
  type Walker,
} from "@/office/office-walk"

/**
 * 퇴근길에 나섰거나 문밖으로 나간 세션이 다시 살아나면 문(또는 지금 선 곳)에서
 * 걸어 들어와 앉는다. 자리로 곧장 옮기면 문 아래로 사라졌던 고양이가 책상에
 * 툭 나타난다.
 */
export function rejoin(
  walker: Walker,
  layout: OfficeLayout,
  index: number,
  door: DoorSide
) {
  if (!walker.out && !walker.leaving) return
  const path = pathToSeat(layout, index)
  if (walker.out) {
    walker.x = layout.door.x
    walker.y = outsideY(layout, door)
  }
  // 문 쪽 샛길에 있으면 통로까지 먼저 걷고, 아니면 통로부터 되짚어 온다.
  const atDoor = walker.out || Math.abs(walker.x - layout.door.x) < 1
  walker.path = atDoor ? path : path.slice(1)
  walker.out = false
  walker.leaving = false
}
