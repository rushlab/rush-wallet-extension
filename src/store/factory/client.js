import Client from '@liquality/client'

import BitcoinSwapProvider from '@liquality/bitcoin-swap-provider'
import BitcoinJsWalletProvider from '@liquality/bitcoin-js-wallet-provider'
import BitcoinRpcProvider from '@liquality/bitcoin-rpc-provider'
import BitcoinEsploraBatchApiProvider from '@liquality/bitcoin-esplora-batch-api-provider'
import BitcoinEsploraSwapFindProvider from '@liquality/bitcoin-esplora-swap-find-provider'
import BitcoinEarnFeeProvider from '@liquality/bitcoin-earn-fee-provider'
import BitcoinRpcFeeProvider from '@liquality/bitcoin-rpc-fee-provider'

import EthereumRpcProvider from '@liquality/ethereum-rpc-provider'
import EthereumJsWalletProvider from '@liquality/ethereum-js-wallet-provider'
import EthereumSwapProvider from '@liquality/ethereum-swap-provider'
import EthereumScraperSwapFindProvider from '@liquality/ethereum-scraper-swap-find-provider'
import EthereumGasStationFeeProvider from '@liquality/ethereum-gas-station-fee-provider'
import EthereumRpcFeeProvider from '@liquality/ethereum-rpc-fee-provider'

import EthereumErc20Provider from '@liquality/ethereum-erc20-provider'
import EthereumErc20SwapProvider from '@liquality/ethereum-erc20-swap-provider'
import EthereumErc20ScraperSwapFindProvider from '@liquality/ethereum-erc20-scraper-swap-find-provider'

import BitcoinNetworks from '@liquality/bitcoin-networks'
import EthereumNetworks from '@liquality/ethereum-networks'

import { isERC20 } from '../../utils/asset'
import cryptoassets from '../../utils/cryptoassets'

export const Networks = ['mainnet', 'testnet']

function createBtcClient (network, mnemonic) {
  const isTestnet = network === 'testnet'
  const bitcoinNetwork = isTestnet ? BitcoinNetworks.bitcoin_testnet : BitcoinNetworks.bitcoin
  const esploraApi = isTestnet ? 'https://liquality.io/testnet/electrs' : 'https://liquality.io/electrs'
  const batchEsploraApi = isTestnet ? 'https://liquality.io/electrs-testnet-batch' : 'https://liquality.io/electrs-batch'
  const rpcUrl = isTestnet ? 'https://liquality.io/bitcointestnetrpc/' : 'https://liquality.io/bitcoinrpc/'
  const rpcUser = isTestnet ? 'bitcoin' : 'liquality'
  const rpcPassword = isTestnet ? 'local321' : 'liquality123'

  /**
   * Temporary provision to ensure `mediantime` is used for block.timestamp
   * Esplora API does not provide the `mediantime` and `timestamp` is not suitable for timelocked applications
   * https://github.com/Blockstream/esplora/issues/269
   * OP_CLTV checks against `mediantime`
   */
  const bitcoinRpcProvider = new BitcoinRpcProvider(rpcUrl, rpcUser, rpcPassword)
  const bitcoinEsploraProvider = new BitcoinEsploraBatchApiProvider(batchEsploraApi, esploraApi, bitcoinNetwork, 2)
  bitcoinEsploraProvider.getBlockByHash = (blockHash) => bitcoinRpcProvider.getBlockByHash(blockHash)

  const btcClient = new Client()
  btcClient.addProvider(bitcoinEsploraProvider)
  btcClient.addProvider(new BitcoinJsWalletProvider(bitcoinNetwork, mnemonic))
  btcClient.addProvider(new BitcoinSwapProvider(bitcoinNetwork))
  btcClient.addProvider(new BitcoinEsploraSwapFindProvider(esploraApi))
  if (isTestnet) btcClient.addProvider(new BitcoinRpcFeeProvider())
  else btcClient.addProvider(new BitcoinEarnFeeProvider('https://liquality.io/swap/mempool/v1/fees/recommended'))

  return btcClient
}

function createEthereumClient (asset, network, rpcApi, scraperApi, FeeProvider, mnemonic) {
  const ethClient = new Client()
  ethClient.addProvider(new EthereumRpcProvider(rpcApi))
  ethClient.addProvider(new EthereumJsWalletProvider(network, mnemonic))
  if (isERC20(asset)) {
    const contractAddress = cryptoassets[asset].contractAddress
    ethClient.addProvider(new EthereumErc20Provider(contractAddress))
    ethClient.addProvider(new EthereumErc20SwapProvider())
    if (scraperApi) ethClient.addProvider(new EthereumErc20ScraperSwapFindProvider(scraperApi))
  } else {
    ethClient.addProvider(new EthereumSwapProvider())
    if (scraperApi) ethClient.addProvider(new EthereumScraperSwapFindProvider(scraperApi))
  }
  ethClient.addProvider(new FeeProvider())

  return ethClient
}

function createEthClient (asset, network, mnemonic) {
  const isTestnet = network === 'testnet'
  const ethereumNetwork = isTestnet ? EthereumNetworks.rinkeby : EthereumNetworks.mainnet
  const infuraApi = isTestnet ? 'https://rinkeby.infura.io/v3/da99ebc8c0964bb8bb757b6f8cc40f1f' : 'https://mainnet.infura.io/v3/da99ebc8c0964bb8bb757b6f8cc40f1f'
  const scraperApi = isTestnet ? 'https://liquality.io/eth-rinkeby-api' : 'https://liquality.io/eth-mainnet-api'
  const FeeProvider = isTestnet ? EthereumRpcFeeProvider : EthereumGasStationFeeProvider

  return createEthereumClient(asset, ethereumNetwork, infuraApi, scraperApi, FeeProvider, mnemonic)
}

function createRskClient (asset, network, mnemonic) {
  const isTestnet = network === 'testnet'
  const rskNetwork = isTestnet ? EthereumNetworks.rsk_testnet : EthereumNetworks.rsk_mainnet
  const rpcApi = isTestnet ? 'https://public-node.testnet.rsk.co' : 'https://public-node.rsk.co'

  // TODO: Setup scraper if performance is issue
  return createEthereumClient(asset, rskNetwork, rpcApi, undefined, EthereumRpcFeeProvider, mnemonic)
}

export const createClient = (asset, network, mnemonic) => {
  if (asset === 'BTC') return createBtcClient(network, mnemonic)
  if (asset === 'RBTC') return createRskClient(asset, network, mnemonic)

  return createEthClient(asset, network, mnemonic)
}
