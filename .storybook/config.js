import { configure } from '@storybook/react';

configure(require.context(
  '../src', true, /\.stories\.(ts|tsx|mdx)$/), module);
