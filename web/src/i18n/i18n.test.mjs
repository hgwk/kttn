import assert from "node:assert/strict"
import test from "node:test"

import { catWords, pickLang, setLang, t } from "./index.ts"
import { en, enCatWords } from "./en.ts"
import { ja, jaCatWords } from "./ja.ts"
import { ko, koCatWords } from "./ko.ts"

const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

test("every language fills every key with the same placeholders", () => {
  for (const [name, dict] of [["en", en], ["ja", ja]]) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(ko).sort(), name)
    for (const key of Object.keys(ko)) {
      assert.deepEqual(holes(dict[key]), holes(ko[key]), `${name} ${key}`)
    }
  }
})

test("cat name lists line up so a session keeps its slot across languages", () => {
  assert.equal(enCatWords.length, koCatWords.length)
  assert.equal(jaCatWords.length, koCatWords.length)
  assert.equal(new Set(koCatWords).size, koCatWords.length)
})

test("the language comes from the URL, then config, then the browser, else English", () => {
  assert.equal(pickLang("ja", "ko", ["en-US"]), "ja")
  assert.equal(pickLang(null, "ko", ["ja-JP"]), "ko")
  assert.equal(pickLang(null, "", ["ja-JP", "en"]), "ja")
  assert.equal(pickLang("fr", "", ["de-DE"]), "en")
})

test("t fills placeholders in the chosen language", () => {
  setLang("en")
  assert.equal(t("status.toolsToday", { n: 3 }), "Today 3 tool calls")
  assert.equal(catWords(), enCatWords)
  setLang("ko")
  assert.equal(t("status.toolsToday", { n: 3 }), "오늘 도구 3회")
})
