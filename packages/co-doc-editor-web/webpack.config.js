const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: './src/index.tsx',

  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'out'),
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {plugins: ['react-refresh/babel']},
          },
        ],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    alias: {
      // react: path.resolve('./node_modules/react'),
      // 'react-dom': path.resolve('./node_modules/react-dom'),
      // 'react-dnd': path.resolve('./node_modules/react-dnd'),
      // 'react-redux': path.resolve('./node_modules/react-redux'),
      // '@fortawesome/react-fontawesome': path.resolve('./node_modules/@fortawesome/react-fontawesome'),
    },
    extensions: ['.web.js', '.js', '.web.ts', '.ts', '.tsx', '.web.tsx', '.css'],
  },

  devServer: {
    port: 8081,
    hot: true,
    static: path.resolve(__dirname, 'public'),
  },

  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin(),
    new CopyPlugin({
      patterns: [{from: 'public', to: ''}],
    }),
  ].filter(Boolean),
};
