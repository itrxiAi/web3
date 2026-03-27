import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // 避免 Next.js 误判 workspace root（例如误选到用户目录下的 lockfile），导致追踪/监听范围过大进而拖慢 dev 热更新
  outputFileTracingRoot: __dirname,
  transpilePackages: ["@reown/appkit", "@reown/appkit-adapter-wagmi"],
  // Reown / WalletConnect：避免服务端打包 pino 等导致 vendor-chunks 引用异常
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  images: {
    domains: ["localhost"],
    dangerouslyAllowSVG: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      porto: false,
      "@base-org/account": false,
      "@metamask/sdk": false,
    };
    // https://docs.reown.com/appkit/next/core/installation#extra-configuration
    if (isServer) {
      const ext = config.externals;
      if (Array.isArray(ext)) {
        ext.push("pino-pretty", "lokijs", "encoding");
      }
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
