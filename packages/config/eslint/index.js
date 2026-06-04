/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
}
