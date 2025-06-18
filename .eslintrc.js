module.exports = {
	root: true,

	env: {
		browser: true,
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},

	ignorePatterns: [
		'.eslintrc.js',
		'**/*.js',
		'**/dist/**',
	],

	overrides: [
		{
			files: ['credentials/**/*.ts'],
			plugins: [
				'eslint-plugin-n8n-nodes-base',
			],
			extends: [
				'plugin:n8n-nodes-base/credentials',
			],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['nodes/**/*.ts'],
			plugins: [
				'eslint-plugin-n8n-nodes-base',
			],
			extends: [
				'plugin:n8n-nodes-base/nodes',
			],
			rules: {
				'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
				'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			},
		},
	],
};
