import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        activeDocument: 'readonly',
        activeWindow: 'readonly',
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'manifest.json', 'vite.config.ts'],
        },
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.json'],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  prettier,
  globalIgnores(['node_modules', 'dist'])
);
