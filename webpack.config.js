const path = require('path')

const babelOptions = {
  // For debugging, just remove "@babel/preset-env":
  presets: ['@babel/preset-env', '@babel/preset-flow'],
  plugins: [['@babel/plugin-transform-for-of', { assumeArray: true }]],
  cacheDirectory: true
}

module.exports = {
  devtool: 'source-map',
  entry: './src/prosusIndex.js',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: { loader: 'babel-loader', options: babelOptions }
      }
    ]
  },
  output: {
    filename: 'edge-currency-prosus.js',
    path: path.join(path.resolve(__dirname), 'lib/react-native')
  },
  resolve: {
    aliasFields: ['react-native'],
    mainFields: ['react-native', 'module', 'main']
  },
  node: {
    fs: 'empty'
  }
}
