import { chains } from '@liquality/cryptoassets'
import cryptoassets from '../utils/cryptoassets'

const EXPLORERS = {
  ethereum: {
    testnet: {
      tx: 'https://rinkeby.etherscan.io/tx/0x',
      address: 'https://rinkeby.etherscan.io/address/'
    },
    mainnet: {
      tx: 'https://etherscan.io/tx/0x',
      address: 'https://etherscan.io/address/'
    }
  },
  bitcoin: {
    testnet: {
      tx: 'https://blockstream.info/testnet/tx/',
      address: 'https://blockstream.info/testnet/address/'
    },
    mainnet: {
      tx: 'https://blockstream.info/tx/',
      address: 'https://blockstream.info/address/'
    }
  },
  rsk: {
    testnet: {
      tx: 'https://explorer.testnet.rsk.co/tx/0x',
      address: 'https://explorer.testnet.rsk.co/address/'
    },
    mainnet: {
      tx: 'https://explorer.rsk.co/tx/0x',
      address: 'https://explorer.rsk.co/address/'
    }
  },
  bsc: {
    testnet: {
      tx: 'https://testnet.bscscan.com/tx/',
      address: 'https://testnet.bscscan.com/address/'
    },
    mainnet: {
      tx: 'https://bscscan.com/tx/',
      address: 'https://bscscan.com/address/'
    }
  }
}

export const isERC20 = asset => {
  return cryptoassets[asset]?.type === 'erc20'
}

// TODO: move to cryptoassets?
export const isEthereumChain = asset => {
  const chain = cryptoassets[asset].chain
  return ['ethereum', 'rsk', 'bsc'].includes(chain)
}

export const getNativeAsset = asset => {
  const chainId = cryptoassets[asset]?.chain
  return chainId ? chains[chainId].nativeAsset : asset
}

export const getAssetColorStyle = asset => {
  const assetData = cryptoassets[asset]
  if (assetData && assetData.color) {
    return { color: assetData.color }
  }
  // return black as default
  return { color: '#000000' }
}

export const getTransactionExplorerLink = (hash, asset, network) => {
  const chain = cryptoassets[asset].chain
  return `${EXPLORERS[chain][network].tx}${hash}`
}

export const getAddressExplorerLink = (address, asset, network) => {
  const chain = cryptoassets[asset].chain
  return `${EXPLORERS[chain][network].address}${address}`
}

export const getAssetIcon = (asset, extension = 'svg') => {
  try {
    return require(`../assets/icons/assets/${asset.toLowerCase()}.${extension}?inline`)
  } catch (e) {
    try {
      return require(`../../node_modules/cryptocurrency-icons/svg/color/${asset.toLowerCase()}.svg?inline`)
    } catch (e) {
      return require('../assets/icons/blank_asset.svg?inline')
    }
  }
}
