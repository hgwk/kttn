import type { Grid } from "./palette"

// 가구와 기기 12. 소품 팔레트로 놓는 취미·잡화 소품. sprite-data.ts가
// 합쳐 ITEMS로 낸다.
export const ITEMS_12 = {
  // 체스판 탁자. 바둑판무늬 위판에 흰 말과 검은 말 몇 개.
  chessTable: [
    "....k.......k...",
    "...kwk.....kxk..",
    "..kkwkk...kkxkk.",
    "kkkkkkkkkkkkkkkk",
    "kwxwxwxwxwxwxwxk",
    "kxwxwxwxwxwxwxwk",
    "kkkkkkkkkkkkkkkk",
    "kddddddddddddddk",
    "kkkkkkkkkkkkkkkk",
    "......kdk.......",
    "......kdk.......",
    "....kkkkkkk.....",
    "....kdddddk.....",
    "....kkkkkkk.....",
  ],
  // 드럼. 빨간 테 두른 큰북, 양옆 작은 북 둘과 노란 심벌.
  drumKit: [
    "kkkkk..........kkkk.",
    ".kSSSk........kSSSk.",
    "..kk.k........k.kk..",
    "....kk.kkkkkk.kk....",
    "..kkkkkwwwwwwkkkkk..",
    ".kwwwkwwwwwwwwkwwwk.",
    ".kMMMkwwwwwwwwkMMMk.",
    ".kwwwkwwwwwwwwkwwwk.",
    ".kkkkkwwwwwwwwkkkkk.",
    "..k..kMwwwwwwMk..k..",
    "..k..kMMMMMMMMk..k..",
    ".kk...kkkkkkkk...kk.",
  ],
  // 책 더미. 바닥에 쌓은 색색의 책 다섯 권, 맨 위에 펼친 책.
  bookPile: [
    "..kkkkkkkk..",
    ".kwwwkkwwwk.",
    ".kkkkkkkkkk.",
    "kMMMMMMMMMMk",
    "kkkkkkkkkkkk",
    ".kNNNNNNNNNk",
    ".kkkkkkkkkkk",
    "kSSSSSSSSSk.",
    "kkkkkkkkkkk.",
    ".k8888888888",
    ".kkkkkkkkkkk",
    "kFFFFFFFFFFk",
    "kkkkkkkkkkkk",
  ],
  // 공구함. 빨간 함과 손잡이, 위로 삐죽 나온 렌치와 드라이버.
  toolbox: [
    "...kk...kk....",
    "...kgk.kNk....",
    "....kgkkNk....",
    "..kkkkkkkkkk..",
    "..k........k..",
    "kkkkkkkkkkkkkk",
    "kMMMMMMMMMMMMk",
    "kMMMMMkkMMMMMk",
    "kMMMMMMMMMMMMk",
    "kKKKKKKKKKKKKk",
    "kkkkkkkkkkkkkk",
  ],
  // 분리수거함. 파랑·초록·노랑 통 셋, 뚜껑에 둥근 구멍.
  recycleBins: [
    ".kkkkk.kkkkk.kkkkk.",
    "kNNkNNkFFkFFkSSkSSk",
    "kkkkkkkkkkkkkkkkkkk",
    "kNNNNNkFFFFFkSSSSSk",
    "kNwwwNkFwwwFkSwwwSk",
    "kNNNNNkFFFFFkSSSSSk",
    "kNNNNNkFFFFFkSSSSSk",
    "kJJJJJkHHHHHk33333k",
    "kkkkkkkkkkkkkkkkkkk",
  ],
} satisfies Record<string, Grid>
