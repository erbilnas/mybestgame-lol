export function useSiteHelp() {
  const rulesOpen = useState('rules-open', () => false)
  const howToPlayOpen = useState('how-to-play-open', () => false)

  function openRules() {
    rulesOpen.value = true
  }

  function openHowToPlay() {
    howToPlayOpen.value = true
  }

  return { rulesOpen, howToPlayOpen, openRules, openHowToPlay }
}
