export default defineAppConfig({
  ui: {
    colors: {
      primary: 'arcade',
      neutral: 'slate'
    },
    button: {
      slots: {
        base: 'font-semibold rounded-2xl transition-colors'
      },
      defaultVariants: {
        size: 'md'
      }
    }
  }
})
