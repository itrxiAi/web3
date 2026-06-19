import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // 避免 Next.js 误判 workspace root（例如误选到用户目录下的 lockfile），导致追踪/监听范围过大进而拖慢 dev 热更新
  outputFileTracingRoot: __dirname,
  transpilePackages: ["@reown/appkit", "@reown/appkit-adapter-wagmi"],
  // Reown / WalletConnect：避免服务端打包 pino 等导致 vendor-chunks 引用异常
  // RAILGUN：@railgun-community/* 与原生 leveldown 仅在服务端运行，作为外部包不进行打包
  serverExternalPackages: [
    "pino-pretty",
    "lokijs",
    "encoding",
    "@railgun-community/wallet",
    "@railgun-community/engine",
    "@railgun-community/shared-models",
    "@railgun-community/ffjavascript",
    "@railgun-community/circomlibjs",
    "@railgun-community/curve25519-scalarmult-wasm",
    "@railgun-community/poseidon-hash-wasm",
    "leveldown",
  ],
  images: {
    domains: ["localhost", "cdn.simpleicons.org"],
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.simpleicons.org",
        pathname: "/**",
      },
    ],
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
