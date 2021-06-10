import { isObject } from 'lodash-es'
import { unlockAsset } from '../utils'
import { updateOrder } from '../../swaps/liquality'

export const updateTransactionFee = async ({ dispatch, commit, getters }, { network, walletId, asset, id, hash, newFee }) => {
  const item = getters.historyItemById(network, walletId, id)

  const hashKey = Object.keys(item).find(key => item[key] === hash)
  const txKey = Object.keys(item).find(key => isObject(item[key]) && item[key].hash === hash)
  const feeKey = {
    tx: 'fee',
    fromFundTx: 'fee',
    toClaimTx: 'claimFee',
    refundTx: 'fee'
  }[txKey]

  const client = getters.client(network, walletId, asset)

  const oldTx = item[txKey]

  let newTx
  const lock = await dispatch('getLockForAsset', { item, network, walletId, asset })
  try {
    newTx = await client.chain.updateTransactionFee(oldTx, newFee)
  } catch (e) {
    console.warn(e)
    throw e
  } finally {
    unlockAsset(lock)
  }

  const updates = {
    [hashKey]: newTx.hash,
    [txKey]: newTx,
    [feeKey]: newTx.feePrice
  }

  commit('UPDATE_HISTORY', {
    network,
    walletId,
    id: id,
    updates
  })

  const isFundingUpdate = hashKey === 'fromFundHash'
  if (isFundingUpdate) {
    const endpoints = getters.agentEndpoints(network)
    const agent = endpoints[0] // TODO: Figure out a way to consider multiple agents if needed
    // TODO: this should be the function of any swap? Should be able to bump any tx
    await updateOrder(agent, item)
  }

  return newTx
}
