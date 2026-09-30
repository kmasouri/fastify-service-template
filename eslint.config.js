const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json'
      }
    }
  },
  {
    // Repositories are only used by services. Routes go through handlers, handlers go through a
    // service.
    files: ['src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data', '**/data/**'],
              message: 'Only services use repositories. Call a service instead.'
            }
          ]
        }
      ]
    }
  },
  {
    // Handlers are below routes, so they never import from routes. Types come from src/schemas.
    files: ['src/handlers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data', '**/data/**'],
              message: 'Only services use repositories. Call a service instead.'
            },
            {
              group: ['**/routes', '**/routes/**'],
              message: 'Handlers never import from routes. Import types from src/schemas.'
            }
          ]
        }
      ]
    }
  },
  {
    // Schemas describe request input and nothing else, so they only use src/shared.
    files: ['src/schemas/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/routes',
                '**/routes/**',
                '**/handlers',
                '**/handlers/**',
                '**/services',
                '**/services/**',
                '**/data',
                '**/data/**',
                '**/plugins',
                '**/plugins/**',
                '**/observability',
                '**/observability/**'
              ],
              message: 'Schemas only import from zod and src/shared.'
            }
          ]
        }
      ]
    }
  }
);
