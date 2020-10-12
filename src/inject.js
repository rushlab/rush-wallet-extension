const providerManager = `
function proxy (type, data) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + '.' + Math.random()

    window.addEventListener(id, ({ detail }) => {
      const response = JSON.parse(detail)
      if (response.error) reject(new Error(response.error))
      else resolve(response.result)
    }, {
      once: true,
      passive: true
    })

    window.postMessage({
      id,
      type,
      data
    }, '*')
  })
}

class InjectedProvider {
  constructor (asset) {
    this.asset = asset
  }

  setClient () {}

  getMethod (method) {
    return (...args) => proxy('CAL_REQUEST', {
      asset: this.asset,
      method,
      args
    })
  }
}

class ProviderManager {
  constructor () {
    this.cache = {}
  }

  getProviderFor (asset) {
    if (this.cache[asset]) return this.cache[asset]

    this.cache[asset] = new InjectedProvider(asset)

    return this.cache[asset]
  }

  enable () {
    return proxy('ENABLE_REQUEST')
  }
}

window.providerManager = new ProviderManager()
`

const ethereumProvider = `
async function getAddresses () {
  const eth = window.providerManager.getProviderFor('ETH')
  let addresses = await eth.getMethod('wallet.getAddresses')()
  addresses = addresses.map(a => '0x' + a.address)
  return addresses
}

async function handleRequest (req) {
  const eth = window.providerManager.getProviderFor('ETH')
  if(req.method.startsWith('metamask_')) return null;
  if(req.method === 'eth_requestAccounts') {
    return await window.ethereum.enable();
  }
  if(req.method === 'personal_sign') { 
    return eth.getMethod('wallet.signMessage')(req.params[0], req.params[1])
  }
  if(req.method === 'eth_sendTransaction') {
    const result = await eth.getMethod('chain.sendTransaction')(req.params[0].to, parseInt(req.params[0].value, 16), req.params[0].data)
    return result.hash
  }
  if(req.method === 'eth_accounts') {
    return getAddresses()
  }
  return eth.getMethod('jsonrpc')(req.method, ...req.params)
}

window.liqualityEthereum = {
  isLiquality: true,
  isEIP1193: true,
  enable: async () => {
    const accepted = await window.providerManager.enable()
    if (!accepted) throw new Error('User rejected')
    return getAddresses()
  },
  request: async (req) => {
    const params = req.params || []
    return handleRequest({
      method: req.method, params
    })
  },
  send: async (req, _params) => {
    const method = typeof req === 'string' ? req : req.method
    const params = req.params || _params || []
    return handleRequest({ method, params })
  },
  sendAsync: (req, callback) => {
    handleRequest(req)
      .then((result) => callback(null, {result}))
      .catch((err) => callback(err))
  },
  on: (method, callback) => {}, // TODO
  autoRefreshOnNetworkChange: false
};

function override() {
  window.ethereum = window.liqualityEthereum
}

if (!window.ethereum) {
  override()
  const retryLimit = 5
  const retries = 0
  const interval = setInterval(() => {
    retries++
    if (window.ethereum && !window.ethereum.isLiquality) {
      override();
      clearInterval(interval)
    }
    if (retries >= retryLimit) clearInterval(interval)
  }, 1000)
} else {
  override();
}
`

export { providerManager, ethereumProvider }
