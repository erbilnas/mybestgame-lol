/** Home paths for prefix_except_default (en `/`, tr `/tr`). */
const HOME_PATHS = new Set(['/', '/tr'])

export function isHomeRoute(path: string) {
  return HOME_PATHS.has(path)
}
