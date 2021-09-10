import { ChainNetworks } from '../store/utils'
import buildConfig from '../build.config'
import { BG_PREFIX, handleConnection, removeConnectId, getRootURL } from './utils'
import { assets } from '@/utils/chains'

class Background {
  constructor (store) {
    this.store = store
    this.internalConnections = []
    this.externalConnections = []

    this.subscribeToMutations()
    this.subscribeToWalletChanges()

    handleConnection(connection => {
      const { url } = connection.sender
      const isInternal = url.startsWith(getRootURL())

      if (isInternal) {
        this.onInternalConnection(connection)
      } else {
        this.onExternalConnection(connection)
      }
    })
  }

  subscribeToMutations () {
    this.store.subscribe(mutation => {
      this.internalConnections.forEach(connection => {
        let { type } = mutation

        if (type.startsWith(connection.name)) return

        type = removeConnectId(type)

        this.sendMutation(connection, { ...mutation, type: BG_PREFIX + type })
      })
    })
  }

  getChainIds (network) {
    return buildConfig.chains.reduce((chainIds, chain) => {
      return Object.assign({}, chainIds, { [chain]: ChainNetworks[chain][network].chainId })
    }, {})
  }

  subscribeToWalletChanges () {
    this.store.subscribe((mutation, state) => {
      if (mutation.type === 'CHANGE_ACTIVE_NETWORK') {
        this.externalConnections.forEach(connection => {
          connection.postMessage({
            id: 'liqualityChainChanged',
            data: { chainIds: this.getChainIds(state.activeNetwork) }
          })
        })
      }
      if (mutation.type === 'SET_ETHEREUM_INJECTION_CHAIN') {
        this.externalConnections.forEach(connection => {
          connection.postMessage({
            id: 'liqualityEthereumOverrideChanged',
            data: { chain: state.injectEthereumChain, chainIds: this.getChainIds(state.activeNetwork) }
          })
        })
      }
    })
  }

  onInternalConnection (connection) {
    this.internalConnections.push(connection)

    connection.onMessage.addListener(message => this.onInternalMessage(connection, message))

    connection.onDisconnect.addListener(() => {
      this.onInternalDisconnect(connection)
      this.unbindMutation(connection)
    })

    this.bindMutation(connection)

    this.store.restored.then(() => connection.postMessage({
      type: 'REHYDRATE_STATE',
      data: this.store.state
    }))
  }

  onExternalConnection (connection) {
    this.externalConnections.push(connection)

    connection.onMessage.addListener(message => this.onExternalMessage(connection, message))

    connection.onDisconnect.addListener(() => {
      this.onExternalDisconnect(connection)
    })
  }

  bindMutation (connection) {
    const { name } = connection
    const { _mutations: mutations } = this.store

    Object.entries(mutations).forEach(([type, funcList]) => {
      const isProxyMutation = this.internalConnections.some(conn => type.startsWith(conn.name))

      if (!isProxyMutation) {
        mutations[name + type] = funcList
      }
    })
  }

  unbindMutation (connection) {
    const { name } = connection
    const { _mutations: mutations } = this.store

    Object.entries(mutations).forEach(([type, funcList]) => {
      if (type.startsWith(name)) {
        delete mutations[type]
      }
    })
  }

  onInternalDisconnect (connection) {
    const index = this.internalConnections.findIndex(conn => conn.name === connection.name)
    if (index !== -1) this.internalConnections.splice(index, 1)
  }

  onInternalMessage (connection, { id, type, data }) {
    switch (type) {
      case 'ACTION_REQUEST':
        this.store.dispatch(data.type, data.payload)
          .then(result => ({ result }))
          .catch(error => {
            console.error(error) /* eslint-disable-line */
            return { error: error.message }
          })
          .then(response => {
            connection.postMessage({
              id,
              type: 'ACTION_RESPONSE',
              data: response
            })
          })
        break

      case 'MUTATION':
        this.store.commit(data.type, data.payload)
        break

      default:
        throw new Error(`Received an invalid message type: ${type}`)
    }
  }

  onExternalMessage (connection, { id, type, data }) {
    const { url } = connection.sender
    const { origin } = new URL(url)
    let chain
    if (data.chain) {
      chain = data.chain
    } else {
      const { asset } = data
      chain = assets[asset].chain
    }
    const { externalConnections, activeWalletId } = this.store.state
    const allowed = Object.keys(externalConnections[activeWalletId] || {}).includes(origin) &&
                    Object.keys(externalConnections[activeWalletId]?.[origin] || {}).includes(chain)

    switch (type) {
      case 'ENABLE_REQUEST':
        if (allowed) {
          connection.postMessage({
            id,
            data: {
              result: true
            }
          })
          return
        }
        this.storeProxy(id, connection, 'requestOriginAccess', { origin, chain })
        break

      case 'CAL_REQUEST':
        if (allowed || data.method === 'jsonrpc') {
          this.storeProxy(id, connection, 'requestPermission', { origin, data })
        } else {
          connection.postMessage({
            id,
            data: {
              error: 'Use enable() method first'
            }
          })
        }
        break

      case 'HANDLE_PAYMENT_URI':
        if (allowed) {
          this.storeProxy(id, connection, 'handlePaymentUri', { data })
        } else {
          connection.postMessage({
            id,
            data: {
              error: 'Use enable() method first'
            }
          })
        }
        break
    }
  }

  onExternalDisconnect (connection) {
    const index = this.externalConnections.findIndex(conn => conn.name === connection.name)
    if (index !== -1) this.externalConnections.splice(index, 1)
  }

  storeProxy (id, connection, action, data) {
    this.store.dispatch(action, data)
      .then(result => ({ result }))
      .catch(error => {
        console.error(error) /* eslint-disable-line */
        return { error: error.toString() }
      })
      .then(response => {
        connection.postMessage({
          id,
          data: response
        })
      })
  }

  sendMutation (connection, mutation) {
    connection.postMessage({
      type: 'MUTATION',
      data: mutation
    })
  }
}

export default Background
