export default defineEventHandler(async () => {
  throw createError({
    statusCode: 410,
    statusMessage: 'Game Director Message links are no longer available'
  })
})
