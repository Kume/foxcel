const swc = require('@rollup/plugin-swc');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonJs = require('@rollup/plugin-commonjs');
const replace = require('@rollup/plugin-replace');

const plugins = [
  swc({
    swc: {
      jsc: {
        parser: {
          tsx: true,
        },
      },
    },
  }),
  nodeResolve({
    exportConditions: ['source', 'default', 'module', 'import'],
    extensions: ['.js', '.ts', '.tsx'],
  }),
  commonJs(),
  replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
  }),
];

exports.default = [
  {
    input: 'src/view/index.ts',
    output: {
      file: 'dist/view.js',
    },
    plugins,
  },
  {
    input: 'src/extension/index.ts',
    output: {
      file: 'dist/extension.js',
      format: 'cjs',
    },
    plugins,
  },
];
