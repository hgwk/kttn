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

/** 장면 하나를 더한다. 어제보다 오래된 날과 하루 한도를 넘는 장면은 지운다. */
export async function addFrame(blob: Blob, at = Date.now()) {
  const day = localDay(at)
  const keep = new Set([day, localDay(at - 86_400_000)])
  const old = await framesOf(day)
  const db = await open()
  try {
    const tx = db.transaction(STORE, "readwrite")
    const store = tx.objectStore(STORE)
    store.put({ day, at, blob } satisfies Frame)
    // 하루 한도를 넘으면 가장 이른 장면부터 지운다.
    for (const frame of old.slice(0, Math.max(0, old.length + 1 - MAX_FRAMES)))
      store.delete([frame.day, frame.at])
    const keys = store.index("day").openKeyCursor()
    keys.onsuccess = () => {
      const cursor = keys.result
      if (!cursor) return
      if (!keep.has(String(cursor.key))) store.delete(cursor.primaryKey)
      cursor.continue()
    }
    await done(tx)
  } finally {
    db.close()
  }
}
