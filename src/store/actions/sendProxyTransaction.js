import { v4 as uuidv4 } from 'uuid'
import { createHistoryNotification } from '../../broker/notification'
import BN from 'bignumber.js'

export const sendProxyTransaction = async ({ dispatch, commit, getters }, { network, walletId, accountId, asset, to, amount = 0, data, fee, gas }) => {
  const client = getters.client(
    {
      network,
      walletId,
      asset,
      accountId
    }
  )

  // const originalEstimateGas = client._providers[0].estimateGas
  // TODO 这里的用途待研究
  // if (gas) {
  //   console.log('@@@ actions.sendTransaction.gas', gas)
  //   client._providers[0].estimateGas = async () => {
  //     return gas
  //   }
  // }

  let tx
  try {
    tx = await client.getMethod('sendProxyTransaction')({ to, value: BN(amount), data, fee })
  } finally {
    // client._providers[0].estimateGas = originalEstimateGas
  }

  const transaction = {
    id: uuidv4(),
    type: 'SEND',
    network,
    walletId,
    to: asset,
    from: asset,
    toAddress: to,
    amount: BN(amount).toNumber(),
    fee,
    tx,
    txHash: tx.hash,
    startTime: Date.now(),
    status: 'WAITING_FOR_CONFIRMATIONS',
    accountId
  }

  commit('NEW_TRASACTION', { network, walletId, accountId, transaction })

  dispatch('performNextAction', { network, walletId, id: transaction.id, accountId })

  createHistoryNotification(transaction)

  return tx
}
