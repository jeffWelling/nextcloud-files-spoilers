/**
 * SPDX-FileCopyrightText: 2024 Jeff <jeff@example.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = {
	entry: {
		'files_spoilers-main': path.join(__dirname, 'src', 'main.js'),
		'files_spoilers-settings': path.join(__dirname, 'src', 'settings.js'),
	},
	output: {
		path: path.resolve(__dirname, 'js'),
		filename: '[name].js',
		chunkFilename: 'files_spoilers-[name].js',
		publicPath: '/apps/files_spoilers/js/',
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: 'vue-loader',
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
				},
			},
			{
				test: /\.s?css$/,
				use: [
					'style-loader',
					'css-loader',
					'sass-loader',
				],
			},
		],
	},
	plugins: [
		new VueLoaderPlugin(),
	],
	resolve: {
		extensions: ['.js', '.vue'],
		alias: {
			vue$: 'vue/dist/vue.esm.js',
		},
		fallback: {
			path: false,
			string_decoder: false,
		},
	},
}
