import path from 'node:path';
import { mergeConfig } from 'vite';

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../features/reservations/wizard/ui/steps/plan-step/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
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
          { find: '@reserve', replacement: path.resolve(__dirname, '../') },
          { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
          { find: '@features', replacement: path.resolve(__dirname, '../features') },
          { find: '@app', replacement: path.resolve(__dirname, '../app') },
          { find: '@tests', replacement: path.resolve(__dirname, '../tests') },
        ],
      },
    });
  },
};

export default config;
