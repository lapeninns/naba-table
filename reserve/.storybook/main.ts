import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';

import type { StorybookConfig } from '@storybook/react-vite';

const storybookDirectory = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../features/reservations/wizard/ui/steps/plan-step/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(baseConfig) {
    return mergeConfig(baseConfig, {
      resolve: {
        alias: [
          { find: '@reserve', replacement: path.resolve(storybookDirectory, '../') },
          { find: '@shared', replacement: path.resolve(storybookDirectory, '../shared') },
          { find: '@features', replacement: path.resolve(storybookDirectory, '../features') },
          { find: '@app', replacement: path.resolve(storybookDirectory, '../app') },
          { find: '@tests', replacement: path.resolve(storybookDirectory, '../tests') },
        ],
      },
    });
  },
};

export default config;
