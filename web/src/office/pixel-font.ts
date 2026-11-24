// 캔버스용 픽셀 기호. 작은 글씨를 fillText로 그린 뒤 확대하면 번지므로
// 자동화실 단말 화면의 기호(5×5)를 칸 단위 비트맵으로 찍는다. 글자는 캔버스
// 위에 둥근모꼴 HTML로 얹는다.

// 한 줄에 다섯 칸씩 다섯 줄.
export const ICONS = {
  alert: "0010000100001000000000100",
  done: "0000000001000101010001000",
  // 물음표. 판정을 보류한 후보가 남은 단말.
  held: "0111000010001000000000100",
} as const

export type IconName = keyof typeof ICONS

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: IconName,
  x: number,
  y: number,
  color: string
) {
  ctx.fillStyle = color
  const bits = ICONS[icon]
  for (let i = 0; i < 25; i++) {
    if (bits[i] === "1")
      ctx.fillRect(
        Math.round(x) + (i % 5),
        Math.round(y) + Math.floor(i / 5),
        1,
        1
      )
  }
}
