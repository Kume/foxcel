const path = require('path');

const distDirPath = path.resolve(__dirname, 'dist');

module.exports = [
  // view
  {
    entry: './src/view/index.tsx',

    mode: 'production',
    output: {
      filename: 'view.js',
      path: distDirPath,
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
        {
          test: /\.jsx$/,
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      ],
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
  },

  // extension
  {
    entry: './src/extension/index.ts',

    output: {
      filename: 'extension.js',
      path: distDirPath,
      libraryTarget: 'commonjs2',
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
  },
];
