# Third-party notices

kttn ships these third-party works inside its binary. License texts are in
`licenses/`.

| Work | Where in kttn | License | Source |
| --- | --- | --- | --- |
| DungGeunMo (둥근모꼴+ Fixedsys) font by 길형진 (orioncactus), used for Korean and English | `web/src/fonts/DungGeunMo.woff2` | Public domain (see below) | https://noonnu.cc/font_page/250, file from https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff, converted to WOFF2 with fontTools. Not Neo둥근모, which is a different font under the OFL. |
| DotGothic16 font, used for Japanese | `web/src/fonts/DotGothic16-Regular.woff2` (converted from the TTF with fontTools) | SIL Open Font License 1.1, `licenses/DotGothic16-OFL.txt` | https://github.com/fontworks-fonts/DotGothic16 (via google/fonts `ofl/dotgothic16`) |

npm dependencies bundled into the screen (React, React DOM, clsx,
tailwind-merge, modern-screenshot) are MIT licensed; their license texts ship in their packages under `web/node_modules`.

## DungGeunMo license, as stated on the noonnu page (2026-11-24)

> 원본과 동일한 퍼블릭 도메인으로 재배포, 수정, 영리 목적 사용 등 걱정 없이 자유롭게 쓰면 됩니다.

(English: "Public domain, the same as the original; redistribute, modify and use
it commercially freely.") The font's own name table also gives its copyright as
"Public Domain".

## Sprites

The cats, furniture, floor tiles and app icon in `web/src/kttn/sprite-art/`
are original pixel art, drawn for this project on character grids. The first
version of kttn used PNGs from a third-party asset pack; those were
removed and replaced with these grids, and the desk, dark desk, monitor,
monitor back, keyboard and chair, the pieces that might have carried that
pack's influence, were later redrawn from scratch at new sizes and shapes. No
external art is included.
