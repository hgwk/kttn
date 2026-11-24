import type { Grid } from "./palette"

// 가구와 기기 14. 소품 팔레트로 놓는 취미·식물·고양이·잡화 소품. sprite-data.ts가
// 합쳐 ITEMS로 낸다.
export const ITEMS_14 = {
  // 스케이트보드. 옆에서 본 빨간 판, 양끝이 들렸고 아래 바퀴 넷 중 둘이 보인다.
  skateboard: [
    "k..............k",
    "kMk..........kMk",
    ".kMMMMMMMMMMMMk.",
    "..kkkkkkkkkkkk..",
    "...kGk....kGk...",
    "..kxxk....kxxk..",
    "..kkkk....kkkk..",
  ],
  // 게임기. 낮은 받침 위 회색 본체, 줄로 이은 조이패드 둘.
  gameConsole: [
    "..kkkkkkkkkk....",
    "..kggggggggk....",
    "..kgxxxxggGk....",
    "..kgg0ggggGk....",
    "..kGGGGGGGGk....",
    "..kkkkkkkkkk....",
    ".....k....k.....",
    "..kkkkk.kkkkk...",
    ".kgkgMkkgNgkgk..",
    ".kgggggkgggggk..",
    "..kkkkk.kkkkk...",
  ],
  // 레몬나무 화분. 둥근 잎 뭉치에 노란 레몬 몇 개.
  lemonTree: [
    "....kkkkkk....",
    "..kkFHFFHFkk..",
    ".kFFSFFHFSFFk.",
    "kFHFFFHFFFFHFk",
    "kFFSFHFFSFHFFk",
    ".kFFHFFFFHFSk.",
    "..kkFSkkFFkk..",
    "....kkbbkk....",
    "......kbk.....",
    "......kbk.....",
    "....kkkkkkk...",
    "....kCCCCKk...",
    ".....kCCKk....",
    ".....kkkkk....",
  ],
  // 고양이 해먹. 나무 틀 사이에 처진 천, 안에서 귀만 보인다.
  catHammock: [
    "kk..............kk",
    "kbk....k..k....kbk",
    "kbkk..kfkkfk..kkbk",
    "kbk.kkkkkkkkkk.kbk",
    "kbk.k88888888k.kbk",
    "kbk..k888888k..kbk",
    "kbk...kkkkkk...kbk",
    "kbk............kbk",
    "kbkkkkkkkkkkkkkkbk",
    "kkk............kkk",
  ],
  // 신발장. 두 칸 선반에 운동화와 장화.
  shoeRack: [
    "kkkkkkkkkkkkkkkk",
    "kaaaaaaaaaaaaaak",
    "kkkkkkkkkkkkkkkk",
    "kb.kkk...kkkk.bk",
    "kbkNNNk.kMMwk.bk",
    "kbkkkkkkkkkkkkbk",
    "kaaaaaaaaaaaaaak",
    "kkkkkkkkkkkkkkkk",
    "kb.kk.kk..kkk.bk",
    "kb.kS.kS.kwwwkbk",
    "kbkSSkSSkkkkkkbk",
    "kkkkkkkkkkkkkkkk",
  ],
  // 대걸레와 양동이. 파란 양동이에 물, 세운 대걸레.
  mopBucket: [
    "........kk..",
    "........kbk.",
    "........kbk.",
    "........kbk.",
    ".k...k..kbk.",
    "..kkk...kbk.",
    "kkkkkkkkkbkk",
    "kWWZWWWk1212",
    "kNNNNNNk2121",
    ".kNNNNk.1212",
    ".kNNNNk.kkkk",
    "..kkkk......",
  ],
} satisfies Record<string, Grid>
