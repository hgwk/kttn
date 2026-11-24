// 사용자 캐릭터 '집사' 그림. 고양이와 같은 16×16 글자 격자다(".": 빈칸).
// 검은 조끼에 빨간 나비넥타이를 맨 집사가 앞·뒤·옆으로 걷는다.

export const BUTLER_PALETTE: Record<string, string> = {
  k: "#2b2a36", // 외곽선
  e: "#2b2a36", // 눈
  h: "#4a3426", // 머리카락
  s: "#f2c9a0", // 피부
  S: "#d9a77f", // 피부 그늘
  w: "#f7f2e8", // 셔츠
  v: "#2f3650", // 조끼
  b: "#c0392b", // 나비넥타이
  p: "#3e4763", // 바지
  o: "#1d1c26", // 구두
}

const FRONT_TOP = [
  "................",
  ".....kkkkkk.....",
  "....khhhhhhk....",
  "...khhhhhhhhk...",
  "...khsssssshk...",
  "...kssessessk...",
  "...kssssssssk...",
  "....kssSSssk....",
  "....kwwbbwwk....",
  "...kvvwbbwvvk...",
  "..ksvvvwwvvvsk..",
  "..ksvvvvvvvvsk..",
  "...kvvvvvvvvk...",
]

const BACK_TOP = [
  "................",
  ".....kkkkkk.....",
  "....khhhhhhk....",
  "...khhhhhhhhk...",
  "...khhhhhhhhk...",
  "...khhhhhhhhk...",
  "...khhhhhhhhk...",
  "....khhhhhhk....",
  "....kwwwwwwk....",
  "...kvvvvvvvvk...",
  "..ksvvvvvvvvsk..",
  "..ksvvvvvvvvsk..",
  "...kvvvvvvvvk...",
]

const LEGS_STAND = ["...kpppkkpppk...", "...kppk..kppk...", "...kook..kook..."]
const LEGS_LEFT = ["...kpppkkpppk...", "...kppk...kpk...", "...kook...kk...."]
const LEGS_RIGHT = ["...kpppkkpppk...", "...kpk...kppk...", "....kk...kook..."]

// 옆모습은 오른쪽을 본다. 왼쪽으로 걸을 때는 뒤집어 그린다.
const SIDE_TOP = [
  "................",
  ".....kkkkk......",
  "....khhhhhk.....",
  "...khhhhhhhk....",
  "...khhhhsssk....",
  "...khhhssesk....",
  "...khhssssssk...",
  "....khsssssk....",
  "....kwwwbwk.....",
  "....kvvwbvk.....",
  "....kvvvsvk.....",
  "....kvvvvvk.....",
  "....kvvvvvk.....",
]
const SIDE_STEP = ["....kpppppk.....", "...kppk.kppk....", "...kook.kook...."]
const SIDE_PASS = ["....kpppppk.....", ".....kppppk.....", ".....kooook....."]

export const BUTLER_FRAMES = {
  front: [
    [...FRONT_TOP, ...LEGS_STAND],
    [...FRONT_TOP, ...LEGS_LEFT],
    [...FRONT_TOP, ...LEGS_STAND],
    [...FRONT_TOP, ...LEGS_RIGHT],
  ],
  back: [
    [...BACK_TOP, ...LEGS_STAND],
    [...BACK_TOP, ...LEGS_LEFT],
    [...BACK_TOP, ...LEGS_STAND],
    [...BACK_TOP, ...LEGS_RIGHT],
  ],
  side: [
    [...SIDE_TOP, ...SIDE_PASS],
    [...SIDE_TOP, ...SIDE_STEP],
    [...SIDE_TOP, ...SIDE_PASS],
    [...SIDE_TOP, ...SIDE_STEP],
  ],
}
