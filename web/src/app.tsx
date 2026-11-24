import { useEffect, useState } from "react"

import { pickLang, setLang, t } from "@/i18n"
import { fetchSnapshot, type ServerSnapshot } from "@/lib/snapshot"
import { AgentOfficeView } from "@/office/agent-office-view"
import { OnboardingNote } from "@/office/onboarding-note"

function applyLang(configured: string) {
  const query = new URLSearchParams(window.location.search).get("lang")
  const chosen = pickLang(query, configured, navigator.languages)
  setLang(chosen)
  document.documentElement.lang = chosen
}

// 첫 화면은 스냅숏 하나를 받은 뒤 그린다. 이후 갱신은 사무실 화면이 폴링한다.
// 언어는 받은 설정으로 정하고, 받기 전 안내 문구는 브라우저 언어를 따른다.
applyLang("")

export function App() {
  const [initial, setInitial] = useState<ServerSnapshot | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchSnapshot().then(
      (snapshot) => {
        applyLang(snapshot.settings.lang)
        setInitial(snapshot)
      },
      () => setFailed(true)
    )
  }, [])

  return (
    <main className="mx-auto grid max-w-[1600px] gap-4 p-4">
      {initial && !initial.settings.configured ? <OnboardingNote /> : null}
      {initial ? (
        <AgentOfficeView initial={initial} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {failed ? t("app.unreachable") : t("app.opening")}
        </p>
      )}
    </main>
  )
}
