export const overlayCloseButton = {
  color: 'neutral' as const,
  variant: 'ghost' as const,
  square: true,
  class: 'size-11 shrink-0 rounded-xl !p-0 inline-flex items-center justify-center'
}

/** Flex placement in header row — avoids absolute positioning against full panel height. */
export const overlayCloseUi = 'ms-auto shrink-0'

export const overlayHeaderUi = {
  header: 'flex items-center gap-2 p-4 sm:px-6 min-h-(--ui-header-height)',
  wrapper: 'min-w-0 flex-1',
  close: overlayCloseUi
}
