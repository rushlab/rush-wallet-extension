/* global browser */

import { prettyBalance } from '@/utils/coinFormatter'
import { getAssetIcon } from '@/utils/asset'
import store from '@/store'

const SEND_STATUS_MAP = {
  WAITING_FOR_CONFIRMATIONS (item) {
    return {
      title: `New ${item.from} Transaction`,
      message: `Sending ${prettyBalance(item.amount, item.from)} ${item.from} to ${item.toAddress}`
    }
  },
  SUCCESS (item) {
    return {
      title: `${item.from} Transaction Confirmed`,
      message: `Sent ${prettyBalance(item.amount, item.from)} ${item.from} to ${item.toAddress}`
    }
  }
}

export const createNotification = config => browser.notifications.create({
  type: 'basic',
  iconUrl: './icons/512x512.png',
  ...config
})

const createSendNotification = item => {
  if (!(item.status in SEND_STATUS_MAP)) return
  const notification = SEND_STATUS_MAP[item.status](item)

  return createNotification({
    iconUrl: getAssetIcon(item.from),
    ...notification
  })
}

export const createHistoryNotification = item => {
  if (item.type === 'SEND') return createSendNotification(item)
}
