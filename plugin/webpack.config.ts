import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig, { type Env } from './.config/webpack/webpack.config';

/**
 * Extend Grafana's scaffolded webpack config.
 * Disable code-splitting — async chunks often fail under Grafana's SystemJS loader.
 */
const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    optimization: {
      splitChunks: {
        chunks: () => false,
      },
    },
  });
};

export default config;
