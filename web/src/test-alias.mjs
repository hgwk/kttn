// 시험(node --test)에서 "@/..." 가져오기를 src 아래 .ts 파일로 잇는다(vite의 별칭과 같다).
import { register } from "node:module"

const src = new URL("./", import.meta.url).href
const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/"))
    return next(${JSON.stringify(src)} + specifier.slice(2) + ".ts", context)
  return next(specifier, context)
}`
register("data:text/javascript," + encodeURIComponent(hooks))
