import { t } from "@/i18n"
import { useEffect, useRef, useState } from "react"

import { TOOL_BUTTON } from "@/office/office-capture"
import type { SessionAgent } from "@/lib/agent-office"
import { soundCues, type SoundCue } from "@/lib/agent-office-sounds"

// 8비트 효과음. 일을 마치면 딩, 확인을 기다리면 삑삑, 레벨이 오르면 짧은
// 팡파레를 사각파로 낸다. 기본은 꺼짐이고, 안내 줄의 소리 버튼으로 켠다(이
// 브라우저에 기억한다). 소리 파일은 없다(Web Audio로 그 자리에서 만든다).

const STORE = "kttn.sounds"

// 음 하나: 주파수(Hz), 시작(초), 길이(초)
type Note = [number, number, number]
const TUNES: Record<SoundCue, Note[]> = {
  done: [
    [1318.5, 0, 0.08],
    [1760, 0.08, 0.18],
  ],
  needsYou: [
    [880, 0, 0.07],
    [880, 0.12, 0.07],
  ],
  levelUp: [
    [523.3, 0, 0.08],
    [659.3, 0.08, 0.08],
    [784, 0.16, 0.08],
    [1046.5, 0.24, 0.22],
  ],
}

function play(audio: AudioContext, cue: SoundCue, delay: number) {
  const start = audio.currentTime + delay
  for (const [freq, at, length] of TUNES[cue]) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = "square"
    osc.frequency.value = freq
    // 사각파는 크게 들리므로 작게, 끝은 짧게 줄여 딸깍 소리를 없앤다.
    gain.gain.setValueAtTime(0.06, start + at)
    gain.gain.linearRampToValueAtTime(0, start + at + length)
    osc.connect(gain).connect(audio.destination)
    osc.start(start + at)
    osc.stop(start + at + length + 0.02)
  }
}

function saved() {
  try {
    return localStorage.getItem(STORE) === "on"
  } catch {
    return false
  }
}

/** 안내 줄의 소리 버튼. 켜져 있으면 현황이 바뀔 때 효과음을 낸다. */
export function OfficeSounds({
  agents,
  levels,
}: {
  agents: SessionAgent[]
  /** 레벨이 오른 세션과 그 시각(새로 들어온 것만 소리를 낸다) */
  levels: { key: string; at: string }[]
}) {
  const [on, setOn] = useState(saved)
  const audio = useRef<AudioContext | null>(null)
  const prev = useRef<Map<string, string> | null>(null)
  // 이미 들은(또는 화면을 열 때 이미 있던) 레벨 업
  const heard = useRef(
    new Set(levels.map((entry) => `${entry.key}@${entry.at}`))
  )

  useEffect(() => {
    const fresh = levels
      .map((entry) => `${entry.key}@${entry.at}`)
      .filter((id) => !heard.current.has(id))
    for (const id of fresh) heard.current.add(id)
    const cues = soundCues(
      prev.current,
      agents,
      fresh.map((id) => id.split("@")[0])
    )
    prev.current = new Map(agents.map((agent) => [agent.key, agent.state]))
    const ctx = audio.current
    if (!on || !ctx || ctx.state !== "running") return
    cues.forEach((cue, index) => play(ctx, cue, index * 0.45))
  }, [agents, levels, on])

  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      localStorage.setItem(STORE, next ? "on" : "off")
    } catch {
      // 저장소를 못 쓰면 이 탭에서만 켠다.
    }
    // 소리는 사용자가 누른 순간에만 열 수 있다(자동 재생 막기).
    if (next) {
      audio.current ??= new AudioContext()
      void audio.current.resume().then(() => {
        if (audio.current) play(audio.current, "done", 0)
      })
    }
  }

  // 켜 둔 채 새로 열면 첫 클릭이나 키 입력 때 소리를 연다.
  useEffect(() => {
    if (!on) return
    const wake = () => {
      audio.current ??= new AudioContext()
      void audio.current.resume()
    }
    window.addEventListener("pointerdown", wake, { once: true })
    window.addEventListener("keydown", wake, { once: true })
    return () => {
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [on])

  return (
    <button
      type="button"
      className={TOOL_BUTTON}
      aria-pressed={on}
      onClick={toggle}
    >
      {on ? t("sound.on") : t("sound.off")}
    </button>
  )
}
