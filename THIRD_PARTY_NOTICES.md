# Third-party notices

kttn ships these third-party works inside its binary. License texts are in
`licenses/`.

| Work | Where in kttn | License | Source |
| --- | --- | --- | --- |
| 8bitcn/ui components (badge, button, card, retro.css) | `web/src/components/ui/8bit/` | MIT, `licenses/8bitcn-ui-LICENSE.txt` | https://github.com/TheOrcDev/8bitcn-ui |
| shadcn/ui components (badge, button, card) | `web/src/components/ui/` | MIT, `licenses/shadcn-ui-LICENSE.txt` | https://github.com/shadcn-ui/ui |
| DungGeunMo (둥근모꼴+ Fixedsys) font by 길형진 (orioncactus), used for Korean and English | `web/src/fonts/DungGeunMo.woff2` | Public domain (see below) | https://noonnu.cc/font_page/250, file from https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff, converted to WOFF2 with fontTools. Not Neo둥근모, which is a different font under the OFL. |
| DotGothic16 font, used for Japanese | `web/src/fonts/DotGothic16-Regular.woff2` (converted from the TTF with fontTools) | SIL Open Font License 1.1, `licenses/DotGothic16-OFL.txt` | https://github.com/fontworks-fonts/DotGothic16 (via google/fonts `ofl/dotgothic16`) |

npm dependencies bundled into the screen (React, React DOM, Base UI,
class-variance-authority, clsx, tailwind-merge, modern-screenshot) are MIT
licensed; their license texts ship in their packages under `web/node_modules`.

## DungGeunMo license, as stated on the noonnu page (2026-11-24)

> 원본과 동일한 퍼블릭 도메인으로 재배포, 수정, 영리 목적 사용 등 걱정 없이 자유롭게 쓰면 됩니다.

(English: "Public domain, the same as the original; redistribute, modify and use
it commercially freely.") The font's own name table also gives its copyright as
"Public Domain".

## Sprites

**Under review.** The cats, furniture, office tiles and app icon in
`web/src/office/sprite-art/` are pixel art drawn on character grids. An earlier
version of the office used a third-party asset pack; whether any current grid
was converted or traced from it is being checked. This section will be updated
with the answer.
