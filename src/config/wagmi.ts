import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { bsc } from 'wagmi/chains'
import { http } from 'wagmi'

// 1. Get projectId from https://cloud.reown.com
const projectId = '46503a41ae74872361114a0403da7f10'

// 自定义 BSC RPC：优先用环境变量（如 Alchemy 节点），避免依赖被墙的 rpc.walletconnect.org
const BSC_RPC_URL = process.env.NEXT_PUBLIC_CHAIN_RPC_URL

// 2. Create a metadata object - optional
const metadata = {
  name: 'HarmonyLink',
  description: 'HarmonyLink - Decentralized Social & Mining Platform',
  url: 'https://dapp.harmonylink.app', // origin must match your domain & subdomain
  icons: ['https://dapp.harmonylink.app/favicon.ico']
}

// 3. Set the networks
const networks = [bsc]

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  // 读链请求（回执轮询/gas 估算）直连自定义 BSC RPC，避免走被墙的 rpc.walletconnect.org
  transports: BSC_RPC_URL ? { [bsc.id]: http(BSC_RPC_URL) } : undefined
})

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: [bsc],
  projectId,
  metadata,
  features: {
    analytics: false // 关闭 pulse.walletconnect.org 埋点，避免国内连接失败
  }
})

export const config = wagmiAdapter.wagmiConfig
