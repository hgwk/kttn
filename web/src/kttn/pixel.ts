// kttn과 자동화실이 함께 쓰는 픽셀 그리기 기본기. 논리 해상도로 그린 뒤
// CSS로 확대하므로 좌표는 모두 정수 픽셀이다.

// 화면에서 논리 픽셀 하나를 몇 픽셀로 보일지. kttn이 화면 폭을 다 채우지 않게 한다.
export const PIXEL_SCALE = 2

export const C = {
  text: "#1b1b1f",
  bubble: "#ffffff",
}

export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}
