// kttn 스프라이트 정본. 이 콘솔을 위해 새로 그린 픽셀 그림이며 외부
// 에셋 팩을 쓰지 않는다. 그림 한 장은 같은 길이의 문자열 줄로 적고, 글자 하나가
// 논리 픽셀 하나다. 글자는 팔레트 키이며 "."은 투명이다. DOM을 쓰지 않으므로
// 서버에서도 읽는다. 그림은 sprite-art/에 나눠 두고(파일당 300줄 이하) 여기서
// 한데 모아 내므로 가져다 쓰는 곳은 이 경로만 본다. 오브젝트를 늘릴 때는
// sprite-art/items-*.ts 가운데 300줄이 넘지 않는 파일에 그림을 더한다.

import { ITEMS_1 } from "./sprite-art/items-1"
import { ITEMS_2 } from "./sprite-art/items-2"
import { ITEMS_3 } from "./sprite-art/items-3"
import { ITEMS_4 } from "./sprite-art/items-4"
import { ITEMS_5 } from "./sprite-art/items-5"
import { ITEMS_6 } from "./sprite-art/items-6"
import { ITEMS_7 } from "./sprite-art/items-7"
import { ITEMS_8 } from "./sprite-art/items-8"
import { ITEMS_9 } from "./sprite-art/items-9"
import { ITEMS_10 } from "./sprite-art/items-10"
import { ITEMS_11 } from "./sprite-art/items-11"
import { ITEMS_12 } from "./sprite-art/items-12"
import { ITEMS_13 } from "./sprite-art/items-13"
import { ITEMS_14 } from "./sprite-art/items-14"
import { ITEMS_15 } from "./sprite-art/items-15"
import { ITEMS_16 } from "./sprite-art/items-16"

export { BASE_PALETTE, INK } from "./sprite-art/palette"
export type { CatKeys, Grid } from "./sprite-art/palette"
export { CAT_POSE, POSE_FRAME } from "./sprite-art/cat-pose"
export { SMOKE } from "./sprite-art/smoke"
export { KITTEN, KITTEN_WAIT } from "./sprite-art/kitten"
export {
  CAT_BACK_WALK,
  CAT_FRONT_WALK,
  CAT_SIDE_PLAY,
  CAT_SIDE_WALK,
} from "./sprite-art/walk"
export { TILES } from "./sprite-art/tiles"
export { clockAt } from "./sprite-art/clock"
export { SEATS } from "./sprite-art/seats"
export type { SeatArt, SeatFrame, SeatName } from "./sprite-art/seats"

/** 가구와 기기. 이름별 그림이며 크기는 그림에서 읽는다. */
export const ITEMS = {
  ...ITEMS_1,
  ...ITEMS_2,
  ...ITEMS_3,
  ...ITEMS_4,
  ...ITEMS_5,
  ...ITEMS_6,
  ...ITEMS_7,
  ...ITEMS_8,
  ...ITEMS_9,
  ...ITEMS_10,
  ...ITEMS_11,
  ...ITEMS_12,
  ...ITEMS_13,
  ...ITEMS_14,
  ...ITEMS_15,
  ...ITEMS_16,
}

export type ItemName = keyof typeof ITEMS
