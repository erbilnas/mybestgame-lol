// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'app/pages',
    files: ['app/pages/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    name: 'app/components/leaderboard',
    files: ['app/components/Leaderboard.vue'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
)
