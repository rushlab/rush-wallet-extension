import _ from 'lodash'
import Bluebird from 'bluebird'

/**
 * 
 * 检测当前 chainId， 更新 assets 以及 assetBalances
 */
export const updateProxyAddressAccountBalances = async ({ state, getters, commit }, { useCache = false } = {}) => {
  const { client } = getters
  commit('START_UPDATING_BALANCE')

  await Bluebird.map(state.proxyAddressAccount.assets, async (asset) => {
    if (!asset) return
    const _client = await client(
      {
        network: 'mainnet',
        asset,
        useCache
      }
    )

    const getProxyAddresses = _client.getMethod('getProxyAddresses').bind(_client)
    let addresses = await getProxyAddresses()
    const balance = addresses.length === 0
      ? 0
      : (await client(
        {
          network: 'mainnet',
          asset,
          useCache
        }
      ).chain.getBalance(addresses)).toNumber()
    commit('UPDATE_PROXY_ADDRESS_ACCOUNT_ASSET_BALANCE', { symbol: asset.symbol, balance })

  }, { concurrency: 1 })
  commit('COMPLETE_UPDATING_BALANCE')
}
