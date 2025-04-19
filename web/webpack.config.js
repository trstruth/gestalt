// web/webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (_env, argv) => {
    const prod = argv.mode === 'production';

    return {
        mode: prod ? 'production' : 'development',
        entry: './src/index.ts',

        /* ---------- loaders ---------- */
        module: {
            rules: [
                /* TypeScript → JS */
                {
                    test: /\.tsx?$/,                 // handles .ts and .tsx
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                /* WASM as async module */
                { test: /\.wasm$/, type: 'webassembly/async' },
                /* Images (emoji sprites, etc.) */
                { test: /\.(png|jpe?g|svg)$/i, type: 'asset/resource' },
            ],
        },
        experiments: { asyncWebAssembly: true },
        resolve: { extensions: ['.ts', '.tsx', '.js'] },

        /* ---------- plugins ---------- */
        plugins: [
            /* 1️⃣ emit index.html */
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, 'src/index.html'),
                minify: prod,
            }),
            /* 2️⃣ copy static assets; no error if folder missing */
            new CopyPlugin({
                patterns: [
                    /* stylesheet */
                    { from: 'src/styles.css', to: '.' },

                    /* all static images in /assets → dist/ root */
                    {
                        from: 'assets/**/*', to({ context, absoluteFilename }) {
                            // put each file (e.g. assets/missingno.png) right next to index.html
                            return path.basename(absoluteFilename);
                        },
                        noErrorOnMissing: true,
                    },
                ],
            }),
        ],

        /* ---------- output ---------- */
        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: prod ? '' : '/',      // relative for Pages, absolute in dev
            clean: true,
        },

        /* ---------- dev server ---------- */
        devServer: prod ? undefined : {
            static: { directory: path.join(__dirname, 'dist'), publicPath: '/' },
            historyApiFallback: true,
            port: 8080,
            open: true,
        },
    };
};

