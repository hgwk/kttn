// 하루 타임랩스의 장면 저장소. 이 브라우저의 IndexedDB에 장면(JPEG)을 날짜별로
// 둔다. 오늘과 어제 것만 남기고, 하루 최대 MAX_FRAMES장이다. 서버로 보내지
// 않는다(장면에는 세션과 폴더 이름이 보이므로 이 컴퓨터에만 둔다).

const DB = "kttn-timelapse"
const STORE = "frames"
const MAX_FRAMES = 160

export type Frame = { day: string; at: number; blob: Blob }

export const localDay = (time: number) =>
  new Date(time).toLocaleDateString("sv")

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, {
        keyPath: ["day", "at"],
      })
      store.createIndex("day", "day")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

/** 그날의 장면들(시각 순) */
export async function framesOf(day: string): Promise<Frame[]> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, "readonly")
    const request = tx.objectStore(STORE).index("day").getAll(day)
    const frames = await new Promise<Frame[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Frame[])
      request.onerror = () => reject(request.error)
    })
    return frames.sort((a, b) => a.at - b.at)
  } finally {
    db.close()
  }
}

/**
 * 장면 하나를 더한다. 어제보다 오래된 날과 하루 한도를 넘는 장면을 먼저 따로
 * 지운 뒤 넣는다(한 트랜잭션에 두면 저장 공간이 모자라 넣기가 실패할 때 지우기도
 * 되돌려져 공간이 영영 비지 않는다). 넣기가 실패하면 그 오류를 그대로 던진다.
 * 5분 안에 찍은 장면이 있으면(다른 탭도 기록 중) 건너뛰고 false를 돌려준다.
 */
export async function addFrame(blob: Blob, at = Date.now()) {
  const day = localDay(at)
  const keep = new Set([day, localDay(at - 86_400_000)])
  const old = await framesOf(day)
  const last = old.at(-1)
  if (last && at - last.at < 5 * 60_000) return false
  const db = await open()
  try {
    const prune = db.transaction(STORE, "readwrite")
    const store = prune.objectStore(STORE)
    for (const frame of old.slice(0, Math.max(0, old.length + 1 - MAX_FRAMES)))
      store.delete([frame.day, frame.at])
    const keys = store.index("day").openKeyCursor()
    keys.onsuccess = () => {
      const cursor = keys.result
      if (!cursor) return
      if (!keep.has(String(cursor.key))) store.delete(cursor.primaryKey)
      cursor.continue()
    }
    await done(prune)
    const put = db.transaction(STORE, "readwrite")
    put.objectStore(STORE).put({ day, at, blob } satisfies Frame)
    await done(put)
    return true
  } finally {
    db.close()
  }
}

/** 저장 공간이 모자라 장면을 넣지 못한 오류인지 */
export const isQuota = (error: unknown) =>
  error instanceof DOMException && error.name === "QuotaExceededError"

/** 이 브라우저에 남긴 장면을 모두 지운다. */
export async function clearFrames() {
  const db = await open()
  try {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).clear()
    await done(tx)
  } finally {
    db.close()
  }
}
