/**
 * Created by paul on 8/8/17.
 */
// @flow

import { bns } from 'biggystring'
import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeEncodeUri,
  type EdgeIo,
  type EdgeLog,
  type EdgeParsedUri,
  type EdgeWalletInfo
} from 'edge-core-js/types'
import prosus_bridge_js from 'prosus-core-js'
import { parse, serialize } from 'uri-js'

import { ProsusEngine } from './prosusEngine.js'
import { currencyInfo } from './prosusInfo.js'
import { DATA_STORE_FILE, WalletLocalData } from './prosusTypes.js'

type InitOptions = {
  apiKey: string
}

function getDenomInfo(denom: string) {
  return currencyInfo.denominations.find(element => {
    return element.name === denom
  })
}

function getParameterByName(param, url) {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

async function makeProsusTools(
  io: EdgeIo,
  log: EdgeLog,
  initOptions: InitOptions
): Promise<EdgeCurrencyTools> {
  const { ProsusApi } = await prosus_bridge_js()

  log(`Creating Currency Plugin for prosus`)
  const options = {
    appUserAgentProduct: 'tester',
    appUserAgentVersion: '0.0.1',
    apiKey: initOptions.apiKey,
    apiServer: 'https://edge.broader.io',
    fetch: io.fetch,
    randomBytes: io.random
  }
  const prosusApi = new ProsusApi(options)

  const prosusPlugin: EdgeCurrencyTools = {
    pluginName: 'prosus',
    currencyInfo,
    prosusApi,

    createPrivateKey: async (walletType: string) => {
      const type = walletType.replace('wallet:', '')

      if (type === 'prosus') {
        const result = await prosusApi.createWallet()
        return {
          prosusKey: result.mnemonic,
          prosusSpendKeyPrivate: result.prosusSpendKeyPrivate,
          prosusSpendKeyPublic: result.prosusSpendKeyPublic
        }
      } else {
        throw new Error('InvalidWalletType')
      }
    },

    derivePublicKey: async (walletInfo: EdgeWalletInfo) => {
      const type = walletInfo.type.replace('wallet:', '')
      if (type === 'prosus') {
        const result = await prosusApi.createWalletFromMnemonic(
          walletInfo.keys.prosusKey
        )
        return {
          prosusAddress: result.prosusAddress,
          prosusViewKeyPrivate: result.prosusViewKeyPrivate,
          prosusViewKeyPublic: result.prosusViewKeyPublic,
          prosusSpendKeyPublic: result.prosusSpendKeyPublic
        }
      } else {
        throw new Error('InvalidWalletType')
      }
    },

    parseUri: async (uri: string): Promise<EdgeParsedUri> => {
      const parsedUri = parse(uri)
      let address: string
      let nativeAmount: string | null = null
      let currencyCode: string | null = null

      if (
        typeof parsedUri.scheme !== 'undefined' &&
        parsedUri.scheme !== 'prosus'
      ) {
        throw new Error('InvalidUriError') // possibly scanning wrong crypto type
      }
      if (typeof parsedUri.host !== 'undefined') {
        address = parsedUri.host
      } else if (typeof parsedUri.path !== 'undefined') {
        address = parsedUri.path
      } else {
        throw new Error('InvalidUriError')
      }
      address = address.replace('/', '') // Remove any slashes

      try {
        // verify address is decodable for currency
        const result = await prosusApi.decodeAddress(address)
        if (result.err_msg === 'Invalid address') {
          throw new Error('InvalidUriError')
        }
      } catch (e) {
        throw new Error('InvalidPublicAddressError')
      }

      const amountStr = getParameterByName('amount', uri)
      if (amountStr && typeof amountStr === 'string') {
        const denom = getDenomInfo('XMR')
        if (!denom) {
          throw new Error('InternalErrorInvalidCurrencyCode')
        }
        nativeAmount = bns.mul(amountStr, denom.multiplier)
        nativeAmount = bns.toFixed(nativeAmount, 0, 0)
        currencyCode = 'XMR'
      }
      const uniqueIdentifier = getParameterByName('tx_payment_id', uri)
      const label = getParameterByName('label', uri)
      const message = getParameterByName('message', uri)
      const category = getParameterByName('category', uri)

      const edgeParsedUri: EdgeParsedUri = {
        publicAddress: address
      }
      if (nativeAmount) {
        edgeParsedUri.nativeAmount = nativeAmount
      }
      if (currencyCode) {
        edgeParsedUri.currencyCode = currencyCode
      }
      if (uniqueIdentifier) {
        edgeParsedUri.uniqueIdentifier = uniqueIdentifier
      }
      if (label || message || category) {
        edgeParsedUri.metadata = {}
        if (label) {
          edgeParsedUri.metadata.name = label
        }
        if (message) {
          edgeParsedUri.metadata.notes = message
        }
        if (category) {
          edgeParsedUri.metadata.category = category
        }
      }

      return edgeParsedUri
    },

    encodeUri: async (obj: EdgeEncodeUri): Promise<string> => {
      if (!obj.publicAddress) {
        throw new Error('InvalidPublicAddressError')
      }
      try {
        const result = await prosusApi.decodeAddress(obj.publicAddress)
        if (result.err_msg === 'Invalid address') {
          throw new Error('InvalidUriError')
        }
      } catch (e) {
        throw new Error('InvalidPublicAddressError')
      }
      if (!obj.nativeAmount && !obj.label && !obj.message) {
        return obj.publicAddress
      } else {
        let queryString: string = ''

        if (typeof obj.nativeAmount === 'string') {
          const currencyCode: string = 'XMR'
          const nativeAmount: string = obj.nativeAmount
          const denom = getDenomInfo(currencyCode)
          if (!denom) {
            throw new Error('InternalErrorInvalidCurrencyCode')
          }
          const amount = bns.div(nativeAmount, denom.multiplier, 12)

          queryString += 'amount=' + amount + '&'
        }
        if (typeof obj.label === 'string') {
          queryString += 'label=' + obj.label + '&'
        }
        if (typeof obj.message === 'string') {
          queryString += 'message=' + obj.message + '&'
        }
        queryString = queryString.substr(0, queryString.length - 1)

        const serializeObj = {
          scheme: 'prosus',
          path: obj.publicAddress,
          query: queryString
        }
        const url = serialize(serializeObj)
        return url
      }
    }
  }

  return prosusPlugin
}

export function makeProsusPlugin(
  opts: EdgeCorePluginOptions
): EdgeCurrencyPlugin {
  const { io, nativeIo, initOptions = { apiKey: '' } } = opts

  if (nativeIo['edge-currency-prosus']) {
    const { callProsus } = nativeIo['edge-currency-prosus']
    global.prosusCore = { methodByString: callProsus }
  }

  let toolsPromise: Promise<EdgeCurrencyTools>
  function makeCurrencyTools(): Promise<EdgeCurrencyTools> {
    if (toolsPromise != null) return toolsPromise
    toolsPromise = makeProsusTools(io, opts.log, initOptions)
    return toolsPromise
  }

  async function makeCurrencyEngine(
    walletInfo: EdgeWalletInfo,
    opts: EdgeCurrencyEngineOptions
  ): Promise<EdgeCurrencyEngine> {
    const tools: EdgeCurrencyTools = await makeCurrencyTools()
    const prosusEngine = new ProsusEngine(
      tools,
      io,
      walletInfo,
      // $FlowFixMe
      tools.prosusApi,
      opts
    )
    await prosusEngine.init()
    try {
      const result = await prosusEngine.walletLocalDisklet.getText(
        DATA_STORE_FILE
      )
      prosusEngine.walletLocalData = new WalletLocalData(result)
      prosusEngine.walletLocalData.prosusAddress =
        prosusEngine.walletInfo.keys.prosusAddress
      prosusEngine.walletLocalData.prosusViewKeyPrivate =
        prosusEngine.walletInfo.keys.prosusViewKeyPrivate
      prosusEngine.walletLocalData.prosusViewKeyPublic =
        prosusEngine.walletInfo.keys.prosusViewKeyPublic
      prosusEngine.walletLocalData.prosusSpendKeyPublic =
        prosusEngine.walletInfo.keys.prosusSpendKeyPublic
    } catch (err) {
      try {
        opts.log(err)
        opts.log('No walletLocalData setup yet: Failure is ok')
        prosusEngine.walletLocalData = new WalletLocalData(null)
        prosusEngine.walletLocalData.prosusAddress =
          prosusEngine.walletInfo.keys.prosusAddress
        prosusEngine.walletLocalData.prosusViewKeyPrivate =
          prosusEngine.walletInfo.keys.prosusViewKeyPrivate
        prosusEngine.walletLocalData.prosusViewKeyPublic =
          prosusEngine.walletInfo.keys.prosusViewKeyPublic
        prosusEngine.walletLocalData.prosusSpendKeyPublic =
          prosusEngine.walletInfo.keys.prosusSpendKeyPublic
        await prosusEngine.walletLocalDisklet.setText(
          DATA_STORE_FILE,
          JSON.stringify(prosusEngine.walletLocalData)
        )
      } catch (e) {
        opts.log.error(
          'Error writing to localDataStore. Engine not started:' + e
        )
      }
    }

    const out: EdgeCurrencyEngine = prosusEngine
    return out
  }

  return {
    currencyInfo,
    makeCurrencyEngine,
    makeCurrencyTools
  }
}
