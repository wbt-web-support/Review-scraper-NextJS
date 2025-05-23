import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals"; 
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { 
    ignores: ["node_modules/", ".next/", "out/", "build/"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"], 
    languageOptions: {
      parser: tseslint.parser, 
      parserOptions: {
        project: "./tsconfig.json", 
      },
      globals: {
        ...globals.browser, 
        ...globals.node,    
        React: "readonly",   
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn", 
        {
          "args": "after-used", 
          "ignoreRestSiblings": true,
          "argsIgnorePattern": "^_", 
          "varsIgnorePattern": "^_", 
          "caughtErrorsIgnorePattern": "^_" 
        }
      ],
    },
  },
];

export default eslintConfig;
