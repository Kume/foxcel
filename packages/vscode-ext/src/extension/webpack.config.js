const path = require('path');

module.exports = {
  entry: './index.ts',

  output: {
    filename: 'extension.js',
    path: path.resolve(__dirname, '..', '..', 'dist'),
    libraryTarget: 'commonjs2'
  },

  mode: 'none',
  target: 'node',

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
  },

  externals: {
    vscode: 'commonjs vscode',
  },
};
