import VuexPersist from 'vuex-persist'
import { omit } from 'lodash-es'

import Background from './Background'
import Foreground from './Foreground'
import { isBackgroundScript } from './utils'

const Broker = state => {
  if (isBackgroundScript(window)) {
    const vuexPersist = new VuexPersist({
      key: 'liquality-wallet-dev-9',
      storage: window.localStorage,
      reducer: s => omit(s, ['unlockedAt', 'wallets'])
    })

    return {
      plugin: store => {
        vuexPersist.plugin(store)
        return new Background(store)
      },
      state
    }
  }

  return {
    plugin: store => new Foreground(store),
    state: {}
  }
}

export default Broker
