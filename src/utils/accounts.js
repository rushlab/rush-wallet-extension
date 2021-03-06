import { v4 as uuidv4 } from 'uuid'
import { getAssetIcon } from '@/utils/asset'
import { chains } from '@/utils/chains'

export const accountCreator = (payload) => {
  const { walletId, account } = payload
  const {
    name,
    chain,
    index,
    addresses,
    assets,
    balances,
    type,
    color
  } = account

  const { formatAddress } = chains[chain]
  const _addresses = addresses.map(a => {
    const address = formatAddress(a)
    return address.startsWith('0x') ? address.substring(2, address.length) : address
  })
  const id = uuidv4()
  const createdAt = Date.now()
  return {
    id,
    walletId,
    type,
    name,
    chain,
    index,
    addresses: _addresses,
    assets,
    balances: balances || {},
    createdAt,
    updatedAt: null,
    color
  }
}

export const accountColors = [
  '#000000',
  '#1CE5C3',
  '#007AFF',
  '#4F67E4',
  '#033fff',
  '#D421EB',
  '#FF287D',
  '#FE7F6B',
  '#EAB300',
  '#F7CA4F',
  '#A1E44A',
  '#3AB24D',
  '#8247E5'
]

export const chainDefaultColors = {
  ethereum: '#4F67E4',
  rsk: '#3AB24D',
  bsc: '#F7CA4F',
  polygon: '#8247E5',
  localhost: '#4F67E4',
  rush: '#4F67E4',
}

export const getAccountIcon = (chain) => {
  return {
    ethereum: getAssetIcon('eth_account'),
    bsc: getAssetIcon('bnb_account', 'png'),
    rsk: getAssetIcon('rsk_account'),
    polygon: getAssetIcon('polygon_account'),
    localhost: getAssetIcon('eth_account'),
    rush: getAssetIcon('eth_account'),
  }[chain]
}

export const getNextAccountColor = (chain, index) => {
  const defaultColor = chainDefaultColors[chain]
  const defaultIndex = accountColors.findIndex(c => c === defaultColor)
  if (defaultIndex === -1) {
    return defaultColor
  }
  const finalIndex = index + defaultIndex
  if (finalIndex >= accountColors.length) {
    return accountColors[defaultIndex]
  }
  return accountColors[finalIndex]
}

export const ACCOUNT_TYPE_OPTIONS = [
  {
    name: 'ETH',
    label: 'ETH',
    type: 'ethereum_imported',
    chain: 'ethereum',
    blockchain: 'Ethereum Blockchain'
  }
]
