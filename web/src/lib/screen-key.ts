// 화면 열쇠. 서버의 세션 자료와 터미널 동작은 이 컴퓨터 사용자의 설정 파일에
// 있는 열쇠를 아는 화면에만 열린다. kttn open(또는 설정 마지막 단계)이 주소
// 끝 #k=<열쇠>로 화면을 열면 브라우저 저장소에 넣고 주소에서는 지운다.
// 조각(#)이라 서버 로그나 Referer로 새지 않는다.

const STORE = "kttn.key"
let key = ""

function remember(value: string) {
  key = value
  try {
    localStorage.setItem(STORE, value)
  } catch {
    // 저장소를 못 쓰면 이 탭에서만 쓴다.
  }
}

/** 주소의 #k=를 읽어 두고 주소에서 지운다. 없으면 저장해 둔 열쇠를 쓴다. */
export function loadScreenKey() {
  const match = /(?:^#|&)k=([A-Za-z0-9_-]+)/.exec(window.location.hash)
  if (match) {
    remember(match[1])
    const url = new URL(window.location.href)
    url.hash = ""
    history.replaceState(null, "", url.pathname + url.search)
    return
  }
  try {
    key = localStorage.getItem(STORE) ?? ""
  } catch {
    key = ""
  }
}

/** 열쇠를 붙여 서버 API를 부른다. */
export function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (key) headers.set("X-Kttn-Key", key)
  return fetch(path, { ...init, headers })
}
