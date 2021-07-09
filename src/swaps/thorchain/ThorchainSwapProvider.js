import BN from 'bignumber.js'
import axios from 'axios'
import * as ethers from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import ERC20 from '@uniswap/v2-core/build/ERC20.json'

import buildConfig from '../../build.config'
import { chains, currencyToUnit, unitToCurrency } from '@liquality/cryptoassets'
import cryptoassets from '@/utils/cryptoassets'
import { isERC20 } from '../../utils/asset'
import { prettyBalance } from '../../utils/coinFormatter'
import { ChainNetworks } from '../../store/utils'
import { withInterval, withLock } from '../../store/actions/performNextAction/utils'
import { getDoubleSwapOutput, getSwapMemo } from '@thorchain/asgardex-util'
import { baseAmount, baseToAsset, assetFromString } from '@xchainjs/xchain-util'
import { SwapProvider } from '../SwapProvider'
import { getTxFee } from '../../utils/fees'
import { mapValues } from 'lodash-es'

// Pool balances are denominated with 8 decimals
const THORCHAIN_DECIMAL = 8

const SUPPORTED_CHAINS = ['bitcoin', 'ethereum']

const OUT_MEMO_TO_STATUS = {
  OUT: 'SUCCESS',
  REFUND: 'FAILED'
}

/**
 * Converts a `BaseAmount` string into `PoolData` balance (always `1e8` decimal based)
 */
const toPoolBalance = (baseAmountString) => baseAmount(baseAmountString, THORCHAIN_DECIMAL)

// TODO: this needs to go into cryptoassets. In fact, we should have large compatibility with the chain.asset notation
// Probably cryptoassets should adopt that kind of naming for assets
const toThorchainAsset = (asset) => {
  return isERC20(asset) ? `ETH.${asset}-${cryptoassets[asset].contractAddress.toUpperCase()}` : `${asset}.${asset}`
} // TODO: ONLY WORKS FOR NATIVE TOKENS

/**
 * Helper to convert decimal of asset amounts
 *
 * It can be used to convert Midgard/THORChain amounts,
 * which are always based on 1e8 decimal into any 1e(n) decimal
 *
 * Examples:
 * ETH.ETH: 1e8 -> 1e18
 * ETH.USDT: 1e8 -> 1e6
 *
 * @param amount BaseAmount to convert
 * @param decimal Target decimal
 */
const convertBaseAmountDecimal = (amount, decimal) => {
  const decimalDiff = decimal - amount.decimal

  const amountBN =
    decimalDiff < 0
      ? amount
        .amount()
        .dividedBy(BN(10 ** (decimalDiff * -1)))
        // Never use `BigNumber`s with decimal within `BaseAmount`
        // that's why we need to set `decimalPlaces` to `0`
        // round down is needed to make sure amount of currency is still available
        // without that, `dividedBy` might round up and provide an currency amount which does not exist
        .decimalPlaces(0, BN.ROUND_DOWN)
      : amount.amount().multipliedBy(BN(10 ** decimalDiff))
  return baseAmount(amountBN, decimal)
}

class ThorchainSwapProvider extends SwapProvider {
  constructor ({ providerId, thornode }) {
    super(providerId)
    this.thornode = thornode
  }

  async getSupportedPairs () {
    return []
  }

  // getMinimumOutput (outputAmount) { // TODO: configurable slippage?
  //   const slippageTolerance = new Percent('50', '10000') // 0.5%
  //   const slippageAdjustedAmountOut = new Fraction(JSBI.BigInt(1))
  //     .add(slippageTolerance)
  //     .invert()
  //     .multiply(outputAmount.quotient).quotient
  //   return CurrencyAmount.fromRawAmount(outputAmount.currency, slippageAdjustedAmountOut)
  // }

  async _getPools () {
    return (await axios.get(`${this.thornode}/thorchain/pools`)).data
  }

  async _getInboundAddresses () {
    return (await axios.get(`${this.thornode}/thorchain/inbound_addresses`)).data
  }

  async _getTransaction (hash) {
    try {
      return (await axios.get(`${this.thornode}/thorchain/tx/${hash}`)).data
    } catch (e) { // Error means tx not found
      return null
    }
  }

  async getQuote ({ network, from, to, amount }) {
    // Only ethereum and bitcoin chains are supported
    if (!SUPPORTED_CHAINS.includes(cryptoassets[from].chain) || !SUPPORTED_CHAINS.includes(cryptoassets[to].chain)) return null

    const pools = await this._getPools() // Cache it

    const fromPoolData = pools.find((pool) => pool.asset === toThorchainAsset(from))
    const toPoolData = pools.find((pool) => pool.asset === toThorchainAsset(to))

    const fromPool = {
      assetBalance: toPoolBalance(fromPoolData.balance_asset),
      runeBalance: toPoolBalance(fromPoolData.balance_rune)
    }

    const toPool = {
      assetBalance: toPoolBalance(toPoolData.balance_asset),
      runeBalance: toPoolBalance(toPoolData.balance_rune)
    }

    const fromAmountInUnit = currencyToUnit(cryptoassets[from], BN(amount))
    const inputAmount = convertBaseAmountDecimal(baseAmount(fromAmountInUnit, cryptoassets[from].decimals), 8)

    // For RUNE it's `getSwapOutput`
    const swapOutput = getDoubleSwapOutput(inputAmount, fromPool, toPool)

    const toAmountInUnit = currencyToUnit(cryptoassets[to], baseToAsset(swapOutput).amount())
    return {
      from,
      to,
      // TODO: Amounts should be in BigNumber to prevent loss of precision
      fromAmount: fromAmountInUnit.toNumber(),
      toAmount: toAmountInUnit.toNumber()
    }
  }

  async approveTokens ({ network, walletId, quote }) {
    const fromChain = cryptoassets[quote.from].chain
    const chainId = ChainNetworks[fromChain][network].chainId

    const api = new ethers.providers.InfuraProvider(chainId, buildConfig.infuraApiKey)
    const erc20 = new ethers.Contract(cryptoassets[quote.from].contractAddress, ERC20.abi, api)

    const inboundAddresses = await this._getInboundAddresses()
    const fromThorchainAsset = assetFromString(toThorchainAsset(quote.from))
    const routerAddress = inboundAddresses.find(inbound => inbound.chain === fromThorchainAsset.chain).router

    const fromAddressRaw = await this.getSwapAddress(network, walletId, quote.from, quote.toAccountId)
    const fromAddress = chains[fromChain].formatAddress(fromAddressRaw)
    const allowance = await erc20.allowance(fromAddress, routerAddress)
    const inputAmount = ethers.BigNumber.from(BN(quote.fromAmount).toFixed())
    if (allowance.gte(inputAmount)) {
      return {
        status: 'APPROVE_CONFIRMED'
      }
    }

    const inputAmountHex = inputAmount.toHexString()
    const encodedData = erc20.interface.encodeFunctionData('approve', [routerAddress, inputAmountHex])

    const account = this.getAccount(quote.fromAccountId)
    const client = this.getClient(network, walletId, quote.from, account?.type)
    const approveTx = await client.chain.sendTransaction({ to: cryptoassets[quote.from].contractAddress, value: 0, data: encodedData, fee: quote.fee })

    return {
      status: 'WAITING_FOR_APPROVE_CONFIRMATIONS',
      approveTx,
      approveTxHash: approveTx.hash
    }
  }

  async sendBitcoinSwap ({ quote, network, walletId, memo }) {
    const account = this.getAccount(quote.fromAccountId)
    await this.sendLedgerNotification(quote, account, 'Signing required to complete the swap.')

    const inboundAddresses = await this._getInboundAddresses()

    const fromThorchainAsset = assetFromString(toThorchainAsset(quote.from))
    const to = inboundAddresses.find(inbound => inbound.chain === fromThorchainAsset.chain).address // Will be `router` for ETH
    const value = BN(quote.fromAmount)
    const encodedMemo = Buffer.from(memo, 'utf-8').toString('hex')

    const client = this.getClient(network, walletId, quote.from, account?.type)
    const swapTx = await client.chain.sendTransaction({ to: to, value, data: encodedMemo, fee: quote.fee })
    return swapTx
  }

  async sendEthereumSwap ({ quote, network, walletId, memo }) {
    const account = this.getAccount(quote.fromAccountId)
    await this.sendLedgerNotification(quote, account, 'Signing required to complete the swap.')

    const inboundAddresses = await this._getInboundAddresses()

    const fromThorchainAsset = assetFromString(toThorchainAsset(quote.from))
    const routerAddress = inboundAddresses.find(inbound => inbound.chain === fromThorchainAsset.chain).router

    const chainId = ChainNetworks[cryptoassets[quote.from].chain][network].chainId
    const api = new ethers.providers.InfuraProvider(chainId, buildConfig.infuraApiKey)
    const tokenAddress = isERC20(quote.from) ? cryptoassets[quote.from].contractAddress : '0x0000000000000000000000000000000000000000'
    const thorchainRouter = new ethers.Contract(routerAddress, ['function deposit(address payable vault, address asset, uint amount, string memory memo) external payable'], api)

    const amountHex = ethers.BigNumber.from(BN(quote.fromAmount).toFixed()).toHexString()
    const to = inboundAddresses.find(inbound => inbound.chain === fromThorchainAsset.chain).address
    const encodedData = thorchainRouter.interface.encodeFunctionData('deposit', [to, tokenAddress, amountHex, memo])
    const value = isERC20(quote.from) ? 0 : BN(quote.fromAmount)

    const client = this.getClient(network, walletId, quote.from, account?.type)
    const swapTx = await client.chain.sendTransaction({ to: routerAddress, value, data: encodedData, fee: quote.fee })

    return swapTx
  }

  async makeMemo ({ network, walletId, quote }) {
    const toChain = cryptoassets[quote.to].chain
    const toAddressRaw = await this.getSwapAddress(network, walletId, quote.to, quote.toAccountId)
    const toAddress = chains[toChain].formatAddress(toAddressRaw)

    const thorchainAsset = assetFromString(toThorchainAsset(quote.to))
    return getSwapMemo({ asset: thorchainAsset, address: toAddress }) // TODO: need to add limit to avoid slippage
  }

  async sendSwap ({ network, walletId, quote }) {
    const memo = await this.makeMemo({ network, walletId, quote })
    let swapTx
    if (quote.from === 'BTC') { // TODO: This should be abstracted, such that each chain has it's own way of sending the moemo, it can be in CAL or can use xchainjs
      swapTx = await this.sendBitcoinSwap({ quote, network, walletId, memo })
    } else if (quote.from === 'ETH' || isERC20(quote.from)) {
      swapTx = await this.sendEthereumSwap({ quote, network, walletId, memo })
    }

    return {
      status: 'WAITING_FOR_SEND_CONFIRMATIONS',
      swapTx,
      swapTxHash: swapTx.hash
    }
  }

  async newSwap ({ network, walletId, quote }) {
    // TODO: check slippage

    const approvalRequired = isERC20(quote.from)
    const updates = approvalRequired
      ? await this.approveTokens({ network, walletId, quote })
      : await this.sendSwap({ network, walletId, quote })

    return {
      id: uuidv4(),
      fee: quote.fee,
      slippage: 50,
      ...updates
    }
  }

  async estimateFees ({ network, walletId, asset, accountId, txType, quote, feePrices, max }) {
    if (txType === ThorchainSwapProvider.txTypes.SWAP_INITIATION && asset === 'BTC') {
      const account = this.getAccount(accountId)
      const client = this.getClient(network, walletId, asset, account.type)
      const value = max ? undefined : BN(quote.fromAmount)
      const memo = await this.getSwapMemo({ network, walletId, quote })
      const encodedMemo = Buffer.from(memo, 'utf-8').toString('hex')
      const txs = feePrices.map(fee => ({ to: '', value, data: encodedMemo, fee }))
      const totalFees = await client.getMethod('getTotalFees')(txs, max)
      return mapValues(totalFees, f => unitToCurrency(cryptoassets[asset], f))
    }

    if (txType in ThorchainSwapProvider.feeUnits) {
      const fees = {}
      for (const feePrice of feePrices) {
        fees[feePrice] = getTxFee(ThorchainSwapProvider.feeUnits[txType], asset, feePrice)
      }
      return fees
    }
  }

  async waitForApproveConfirmations ({ swap, network, walletId }) {
    const account = this.getAccount(swap.fromAccountId)
    const client = this.getClient(network, walletId, swap.from, account?.type)

    try {
      const tx = await client.chain.getTransactionByHash(swap.approveTxHash)
      if (tx && tx.confirmations > 0) {
        return {
          endTime: Date.now(),
          status: 'APPROVE_CONFIRMED'
        }
      }
    } catch (e) {
      if (e.name === 'TxNotFoundError') console.warn(e)
      else throw e
    }
  }

  async waitForSendConfirmations ({ swap, network, walletId }) {
    const account = this.getAccount(swap.fromAccountId)
    const client = this.getClient(network, walletId, swap.from, account?.type)

    try {
      const tx = await client.chain.getTransactionByHash(swap.swapTxHash)
      if (tx && tx.confirmations > 0) {
        return {
          endTime: Date.now(),
          status: 'WAITING_FOR_RECEIVE'
        }
      }
    } catch (e) {
      if (e.name === 'TxNotFoundError') console.warn(e)
      else throw e
    }
  }

  async waitForReceive ({ swap, network, walletId }) {
    try {
      const thorchainTx = await this._getTransaction(swap.swapTxHash)
      const receiveHash = thorchainTx.observed_tx?.out_hashes?.[0]
      if (receiveHash) {
        const thorchainReceiveTx = await this._getTransaction(receiveHash)
        if (thorchainReceiveTx) {
          const memo = thorchainReceiveTx.observed_tx.tx.memo
          const memoAction = memo.split(':')[0]

          let asset
          let account
          if (memoAction === 'OUT') {
            asset = swap.to
            account = this.getAccount(swap.toAccountId)
          } else if (memoAction === 'REFUND') {
            asset = swap.from
            account = this.getAccount(swap.fromAccountId)
          }

          const client = this.getClient(network, walletId, asset, account?.type)
          const receiveTx = await client.chain.getTransactionByHash(receiveHash)

          if (receiveTx && receiveTx.confirmations > 0) {
            this.updateBalances({ network, walletId, assets: [asset] })
            const status = OUT_MEMO_TO_STATUS[memoAction]
            return {
              receiveTxHash: receiveTx.hash,
              receiveTx: receiveTx,
              endTime: Date.now(),
              status
            }
          } else {
            return {
              receiveTxHash: receiveTx.hash,
              receiveTx: receiveTx
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'TxNotFoundError') console.warn(e)
      else throw e
    }
  }

  async performNextSwapAction (store, { network, walletId, swap }) {
    let updates

    switch (swap.status) {
      case 'WAITING_FOR_APPROVE_CONFIRMATIONS':
        updates = await withInterval(async () => this.waitForApproveConfirmations({ swap, network, walletId }))
        break
      case 'APPROVE_CONFIRMED':
        updates = await withLock(store, { item: swap, network, walletId, asset: swap.from },
          async () => this.sendSwap({ quote: swap, network, walletId }))
        break
      case 'WAITING_FOR_SEND_CONFIRMATIONS':
        updates = await withInterval(async () => this.waitForSendConfirmations({ swap, network, walletId }))
        break
      case 'WAITING_FOR_RECEIVE':
        updates = await withInterval(async () => this.waitForReceive({ swap, network, walletId }))
        break
    }

    return updates
  }

  static txTypes = {
    SWAP: 'SWAP'
  }

  static feeUnits = {
    SWAP: {
      BTC: 600, // TODO: Temporary number, should actually use getTotalFee() from CAL
      ETH: 100000 + 400000, // (potential)ERC20 Approval + Swap
      BNB: 100000 + 400000,
      MATIC: 100000 + 400000,
      ERC20: 100000 + 400000
    }
  }

  static statuses = {
    WAITING_FOR_APPROVE_CONFIRMATIONS: {
      step: 0,
      label: 'Approving {from}',
      filterStatus: 'PENDING',
      notification (swap) {
        return {
          message: `Approving ${swap.from}`
        }
      }
    },
    APPROVE_CONFIRMED: {
      step: 1,
      label: 'Swapping {from}',
      filterStatus: 'PENDING'
    },
    WAITING_FOR_SEND_CONFIRMATIONS: {
      step: 1,
      label: 'Swapping {from}',
      filterStatus: 'PENDING',
      notification () {
        return {
          message: 'Swap initiated'
        }
      }
    },
    WAITING_FOR_RECEIVE: {
      step: 2,
      label: 'Swapping {from}',
      filterStatus: 'PENDING'
    },
    SUCCESS: {
      step: 3,
      label: 'Completed',
      filterStatus: 'COMPLETED',
      notification (swap) {
        return {
          message: `Swap completed, ${prettyBalance(swap.toAmount, swap.to)} ${swap.to} ready to use`
        }
      }
    },
    FAILED: {
      step: 3,
      label: 'Swap Failed',
      filterStatus: 'REFUNDED',
      notification () {
        return {
          message: 'Swap failed'
        }
      }
    }
  }

  static fromTxType = ThorchainSwapProvider.txTypes.SWAP
  static toTxType = null

  static totalSteps = 4
}

export { ThorchainSwapProvider }
