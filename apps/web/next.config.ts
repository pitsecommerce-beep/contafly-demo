import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@contafly/ui'],
  poweredByHeader: false,
  webpack(cfg) {
    // Los paquetes usan imports ESM con extensión .js que apuntan a archivos .ts
    cfg.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return cfg;
  },
};

export default config;
