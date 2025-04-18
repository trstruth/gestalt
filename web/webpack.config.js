const path = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: 'development',
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist')
        },
        port: 8080,
        open: true,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.wasm$/,
                type: 'webassembly/async',
            },
            {
                test: /\.(png|jpe?g|svg)$/i,
                type: 'asset/resource',
            },
        ],
    },
    experiments: {
        asyncWebAssembly: true,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        // Ensure asset URLs are relative to the output folder.
        publicPath: '/'
    },
};
