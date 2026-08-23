import { initDb } from '../database/index'

export default defineNitroPlugin(() => {
  initDb()
})
