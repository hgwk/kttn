import type { Grid } from "./palette"

// 가구와 기기 16. 소품 팔레트로 놓는 식물·고양이·잡화 소품. sprite-data.ts가
// 합쳐 ITEMS로 낸다.
export const ITEMS_16 = {
  // 대나무 화분. 테두리 없는 가는 초록 줄기 셋에 마디와 잎, 흰 화분.
  bamboo: [
    "...F...F....",
    "..FHF.FHF...",
    ".F.F.F.F.FF.",
    "...F.F.FHF..",
    "...H.F.F....",
    "...F.H.F....",
    "...F.F.H....",
    "...H.F.F....",
    "...F.H.F....",
    "...F.F.H....",
    "...F.F.F....",
    "..kkkkkkkk..",
    "..kwwwwwgk..",
    "..kwwwwwgk..",
    "...kkkkkk...",
  ],
  // 테라리움. 둥근 유리병 안에 이끼와 작은 버섯, 나무 받침.
  terrarium: [
    "....kkkk....",
    "...kWkkWk...",
    "..kWWWWhWk..",
    ".kWWWWWWhWk.",
    ".kWWkMMkWWk.",
    ".kWWWkkWWWk.",
    ".kFFFHkFFFk.",
    ".kHFFFFFHFk.",
    "..k33433k...",
    "..kkkkkkkk..",
    ".kddddddddk.",
    ".kkkkkkkkkk.",
  ],
  // 생선 인형. 고양이 장난감용 파란 천 생선, 꼬리와 눈.
  fishToy: [
    "..kkkkk...kk",
    ".kNNNNNk.kNk",
    "kNkNNNNNkNNk",
    "kNNNNNNNNNk.",
    ".kZZZZZkkZZk",
    "..kkkkk...kk",
  ],
  // 여행 가방. 손잡이 올린 빨간 바퀴 가방과 띠.
  suitcase: [
    "...kkkk...",
    "...k..k...",
    "...k..k...",
    ".kkkkkkkk.",
    "kMMMMMMMMk",
    "kMkMMMMkMk",
    "kMkMMMMkMk",
    "kwwwwwwwwk",
    "kMkMMMMkMk",
    "kMkMMMMkMk",
    "kKKKKKKKKk",
    ".kkkkkkkk.",
    ".kk....kk.",
  ],
  // 라바콘. 주황 고깔에 흰 띠 둘, 검은 받침.
  trafficCone: [
    "....kk....",
    "...k77k...",
    "...k77k...",
    "..kwwwwk..",
    "..k7777k..",
    ".k777777k.",
    ".kwwwwwwk.",
    "k77777777k",
    "kkkkkkkkkk",
  ],
} satisfies Record<string, Grid>
