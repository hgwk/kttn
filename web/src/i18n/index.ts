// 화면 언어. 페이지를 열 때 한 번 정하고(setLang) 바꾸려면 다시 연다.
// 모듈 하나가 현재 언어를 들고 있어 순수 함수에서도 t()를 바로 쓴다.

import { en, enCatWords } from "./en.ts"
import { ja, jaCatWords } from "./ja.ts"
import { ko, koCatWords, type MessageKey } from "./ko.ts"

export type Lang = "ko" | "en" | "ja"
export type { MessageKey }

const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { ko, en, ja }
const CAT_WORDS: Record<Lang, string[]> = {
  ko: koCatWords,
  en: enCatWords,
  ja: jaCatWords,
}

let current: Lang = "ko"

function isLang(value: string): value is Lang {
  return value === "ko" || value === "en" || value === "ja"
}

/**
 * 쓸 언어를 고른다. 주소의 ?lang=, 설정, 브라우저 언어 순서이고 셋 다
 * 모르는 언어면 영어다.
 */
export function pickLang(
  query: string | null,
  configured: string,
  browser: readonly string[]
): Lang {
  for (const candidate of [query ?? "", configured, ...browser]) {
    const short = candidate.toLowerCase().slice(0, 2)
    if (isLang(short)) return short
  }
  return "en"
}

export function setLang(lang: Lang) {
  current = lang
}

export function lang(): Lang {
  return current
}

/** 사전의 문구를 꺼내 {이름} 자리를 채운다. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}) {
  return DICTIONARIES[current][key].replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole
  )
}

/** 고양이 이름 앞말 목록. 언어마다 같은 길이라 같은 세션은 같은 자리를 쓴다. */
export function catWords() {
  return CAT_WORDS[current]
}
