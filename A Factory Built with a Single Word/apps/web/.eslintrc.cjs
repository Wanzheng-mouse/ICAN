module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh', '@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'react-hooks/exhaustive-deps': 'off',
  },
};
