module.exports = {
    root: true,
    env: {
        es6: true,
        node: true
    },
    extends: [
        "eslint:recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "google",
        "plugin:@typescript-eslint/recommended"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
        sourceType: "module"
    },
    ignorePatterns: [
        "/lib/**/*", // Ignore built files.
        "/modules/**/*" // Ignore external modules
    ],
    plugins: [
        "@typescript-eslint",
        "import"
    ],
    rules: {
        "operator-linebreak": ["error", "before"],
        "quotes": ["error", "double"],
        "import/no-unresolved": 0,
        "indent": ["error", 4, {"SwitchCase": 1}],
        "linebreak-style": 0,
        "comma-dangle": ["error", "never"],
        "max-len": ["error", {"code": 140}],
        "require-jsdoc": 0,
        "valid-jsdoc": ["warn", {
            "requireReturnType": false,
            "requireParamDescription": true,
            "requireReturnDescription": false,
            "requireParamType": false,
            "requireReturn": false,
            "matchDescription": ""
        }]
    }
};
