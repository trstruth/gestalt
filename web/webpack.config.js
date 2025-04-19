// webpack.config.js
const path = require('path');

module.exports = (_env, argv) => {
    const prod = argv.mode === 'production';          // `webpack --mode production`
    return {
        entry: './src/index.ts',
        mode: prod ? 'production' : 'development',

        devServer: prod ? undefined : {                  // keep dev‑server only in dev
            static: { directory: path.join(__dirname, 'dist') },
            port: 8080,
            open: true,
        },

        module: {
            rules: [
                { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
                { test: /\.wasm$/, type: 'webassembly/async' },
                { test: /\.(png|jpe?g|svg)$/i, type: 'asset/resource' },
            ],
        },
        experiments: { asyncWebAssembly: true },
        resolve: { extensions: ['.ts', '.js'] },

        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: prod ? '' : '/',      // ← relative for Pages, absolute for dev
            clean: true,                      // clears old builds
        },
    };
};

