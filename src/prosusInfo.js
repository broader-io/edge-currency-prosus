// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { MoneroSettings } from './xmrTypes.js'

const otherSettings: MoneroSettings = {
  mymoneroApiServers: ['https://edge.mymonero.com:8443']
}

const defaultSettings: any = {
  otherSettings
}

export const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'Prosus',
  displayName: 'Prosus',
  pluginId: 'prosus',
  requiredConfirmations: 10,
  walletType: 'wallet:prosus',

  defaultSettings,

  addressExplorer: 'https://xmrchain.net/search?value=%s',
  transactionExplorer:
    'https://blockchair.com/monero/transaction/%s?from=edgeapp',

  denominations: [
    // An array of Objects of the possible denominations for this currency
    {
      name: 'Prosus',
      multiplier: '1000000000000',
      symbol: '‎p'
    }
  ],
  metaTokens: []
}
