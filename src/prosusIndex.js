// @flow

import 'regenerator-runtime/runtime'

import { makeProsusPlugin } from './prosusPlugin.js'

const edgeCorePlugins = {
  prosus: makeProsusPlugin
}

export default edgeCorePlugins

if (
  typeof window !== 'undefined' &&
  typeof window.addEdgeCorePlugins === 'function'
) {
  window.addEdgeCorePlugins(edgeCorePlugins)
}
