module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'boundaries'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:boundaries/strict',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'eslint.config.js'],
  settings: {
    'boundaries/elements': [
      {
        type: 'domain',
        pattern: 'src/modules/*/domain/**/*',
      },
      {
        type: 'application',
        pattern: 'src/modules/*/application/**/*',
      },
      {
        type: 'infrastructure',
        pattern: 'src/modules/*/infrastructure/**/*',
      },
      {
        type: 'interface',
        pattern: 'src/modules/*/interface/**/*',
      },
      {
        type: 'shared',
        pattern: 'src/shared/**/*',
      },
      {
        type: 'module',
        pattern: 'src/modules/*/*.module.ts',
      },
    ],
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'boundaries/element-types': [
      2,
      {
        default: 'disallow',
        rules: [
          // Domain no puede importar nada excepto de shared
          {
            from: 'domain',
            allow: ['shared'],
          },
          // Application puede importar de domain y shared, pero NO de infrastructure ni interface
          {
            from: 'application',
            allow: ['domain', 'shared'],
          },
          // Infrastructure implementa application y domain
          {
            from: 'infrastructure',
            allow: ['application', 'domain', 'shared'],
          },
          // Interface (HTTP/WS) consume application
          {
            from: 'interface',
            allow: ['application', 'domain', 'shared'],
          },
          // Modules pueden importar de todo para orquestar (dentro de su propio módulo)
          {
            from: 'module',
            allow: ['interface', 'application', 'infrastructure', 'domain', 'shared'],
          },
          // Shared puede importarse a sí mismo
          {
            from: 'shared',
            allow: ['shared'],
          },
        ],
      },
    ],
  },
};
