import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // 避免 Next.js 误判 workspace root（例如误选到用户目录下的 lockfile），导致追踪/监听范围过大进而拖慢 dev 热更新
  outputFileTracingRoot: __dirname,
  // build 时跳过 ESLint 和 TS 类型检查（开发时单独跑 lint / tsc 即可）
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["@reown/appkit", "@reown/appkit-adapter-wagmi"],
  // Reown / WalletConnect：避免服务端打包 pino 等导致 vendor-chunks 引用异常
  // RAILGUN：@railgun-community/* 与原生 leveldown 仅在服务端运行，作为外部包不进行打包
  // Solana：@solana/* 仅在服务端 API 路由中使用，客户端已全部注释
  // exceljs：仅在 admin 页面动态使用，不需要打包进客户端 bundle
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
    "@solana/web3.js",
    "@solana/spl-token",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-tokenpocket",
    "exceljs",
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
      "@solana/wallet-adapter-react": false,
      "@solana/wallet-adapter-react-ui": false,
      "@solana/wallet-adapter-tokenpocket": false,
      "@solana/spl-token": false,
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
