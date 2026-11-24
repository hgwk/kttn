import { t } from "@/i18n"

/** kttn init 전이면 사무실 위에 설정 방법을 알린다. */
export function OnboardingNote() {
  const [before, after] = t("onboarding.body").split("{command}")
  return (
    <section
      aria-labelledby="kttn-onboarding"
      className="border-2 border-[#2b2a36] bg-[#fffdf7] px-3 py-2 text-sm text-[#2b2a36]"
    >
      <h2 id="kttn-onboarding" className="font-bold">
        {t("onboarding.title")}
      </h2>
      <p>
        {before}
        <code className="bg-[#2b2a36] px-1 text-[#f7f2e8]">kttn init</code>
        {after}
      </p>
    </section>
  )
}
