import { useState, type CSSProperties, type ReactNode } from "react"

import { t } from "@/i18n"
import type { SessionAgent } from "@/lib/agent-office"

// 고양이를 눌러 할 수 있는 일. 이 화면에서 세션에 손을 대는 곳은 여기뿐이다.
//   고양이(책상)를 누른다  → 집사가 걸어가 그 세션의 터미널 탭을 연다(butler.tsx).
//   대사 상자를 누른다      → 메시지 칸이 열리고, 보내면 그 세션 입력란에 들어가 Enter까지 눌린다.
// 서버 쪽은 /api/focus, /api/message(같은 화면에서 보낸 JSON만 받는다).

/** 이보다 긴 메시지는 서버가 받지 않는다(413). */
const MAX_CHARS = 2000

/** 실패한 응답 상태를 쉬운 말로. 서버의 영문 사유 대신 보인다. */
export function actionError(status: number) {
  if (status === 404) return t("action.noTab")
  if (status === 409) return t("action.notNow")
  if (status === 413) return t("action.tooLong")
  if (status === 503) return t("action.noTerminal")
  if (status === 400) return t("action.empty")
  return t("action.failed")
}

/**
 * 고양이 책상 자리. 집사가 지나가지 못하고(data-obstacle), 누르면 집사가
 * 걸어간다(data-desk로 자리를 찾는다).
 */
export function CatDesk({
  agentKey,
  name,
  style,
}: {
  agentKey: string
  name: string
  style: CSSProperties
}) {
  return (
    <button
      type="button"
      data-obstacle=""
      data-desk={agentKey}
      aria-label={t("action.openTab", { name })}
      title={t("action.openTabTitle", { name })}
      className="absolute cursor-pointer rounded-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-400"
      style={style}
      onClick={(event) =>
        event.currentTarget
          .closest("[data-floor]")
          ?.dispatchEvent(
            new CustomEvent("butler:visit", { detail: { key: agentKey } })
          )
      }
    />
  )
}

/**
 * 대사 상자. 누르면 아래에 메시지 칸을 연다. 확인을 기다리는(needs_you)
 * 고양이에게는 보내지 않는다(권한 창에 글이 들어가면 안 된다).
 */
export function CatMessage({
  agent,
  name,
  children,
}: {
  agent: SessionAgent
  name: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const blocked =
    agent.state === "needs_you"
      ? t("action.blockedNeedsYou")
      : agent.state === "ended"
        ? t("action.blockedEnded")
        : ""

  const send = async () => {
    const message = text.trim()
    if (!message || sending || blocked) return
    setSending(true)
    setNote("")
    try {
      const response = await fetch("/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: agent.key, text: message }),
      })
      if (response.ok) {
        setText("")
        setOpen(false)
        return
      }
      setNote(
        t("action.sendFailedBecause", { reason: actionError(response.status) })
      )
    } catch {
      setNote(t("action.sendFailed"))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("action.messageTo", { name })}
        className="block cursor-pointer text-left"
        onClick={() => {
          setOpen((value) => !value)
          setNote("")
        }}
      >
        {children}
      </button>
      {open ? (
        <form
          className="absolute top-full left-1/2 z-50 mt-1 grid w-60 -translate-x-1/2 gap-1 border-2 border-[#2b2a36] bg-[#fffdf7] p-1.5 text-[11px] leading-[14px] text-[#2b2a36]"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <p>
            <b>{name}</b> {t("action.messageHint")}
          </p>
          {blocked ? (
            <p className="text-amber-700">{blocked}</p>
          ) : (
            <textarea
              autoFocus
              rows={3}
              maxLength={MAX_CHARS}
              value={text}
              placeholder={t("action.placeholder")}
              className="w-full resize-none border-2 border-[#2b2a36] bg-white p-1 text-[11px]"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false)
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
          )}
          {note ? (
            <p role="alert" className="text-red-700">
              {note}
            </p>
          ) : null}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="border-2 border-[#2b2a36] px-1.5"
              onClick={() => setOpen(false)}
            >
              {t("action.close")}
            </button>
            {blocked ? null : (
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="border-2 border-[#2b2a36] bg-[#2b2a36] px-1.5 text-[#f7f2e8] disabled:opacity-50"
              >
                {sending ? t("action.sending") : t("action.send")}
              </button>
            )}
          </div>
        </form>
      ) : null}
    </>
  )
}
