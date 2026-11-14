import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import nextPlugin from "@next/eslint-plugin-next";

const sourceFiles = ["src/**/*.{js,jsx,ts,tsx}", "tests/**/*.ts"];
export default [
  { ignores: [".next/**", ".vinext/**", ".open-next/**", "node_modules/**", "coverage/**"] },
  {
    files: sourceFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
      globals: { console: "readonly", process: "readonly", Request: "readonly", URL: "readonly" },
    },
    plugins: { "@typescript-eslint": tsPlugin, "jsx-a11y": jsxA11y, react: reactPlugin, "@next/next": nextPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
    settings: { react: { version: "detect" } },
  },
];
