const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const n8nNodesBase = require("eslint-plugin-n8n-nodes-base");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
        },

        parser: tsParser,
        sourceType: "module",

        parserOptions: {
            project: "tsconfig.json",
            extraFileExtensions: [".json"],
        },
    },
}, globalIgnores(["**/.eslintrc.js", "**/*.js", "**/dist/**/*"]), {
    files: ["credentials/**/*.ts"],

    plugins: {
        "n8n-nodes-base": n8nNodesBase,
    },

    extends: compat.extends("plugin:n8n-nodes-base/credentials"),

    rules: {
        "n8n-nodes-base/cred-class-field-documentation-url-miscased": "off",
    },
}, {
    files: ["nodes/**/*.ts"],

    plugins: {
        "n8n-nodes-base": n8nNodesBase,
    },

    extends: compat.extends("plugin:n8n-nodes-base/nodes"),

    rules: {
        "n8n-nodes-base/node-class-description-inputs-wrong-regular-node": "off",
        "n8n-nodes-base/node-class-description-outputs-wrong": "off",
    },
}]);
