'use client'

import { useEffect, useState } from 'react'
import Theme from '../theme-provider'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Header from '@/components/ui/header'
import ConnectWallet from '@/components/connect-wallet'
import { WalletRefProvider } from '@/components/ui/wallet-ref'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/config/wagmi' // Initialize Reown AppKit configuration

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    AOS.init({
      once: true,
      disable: 'phone',
      duration: 600,
      easing: 'ease-out-sine',
    })
  }, [])

  // 单例：避免每次 layout 重渲染时 new QueryClient，导致缓存丢失与额外开销
  const [queryClient] = useState(() => new QueryClient())

  return (
    <Theme>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <WalletRefProvider>
            <div className="flex flex-col min-h-screen overflow-hidden bg-black">
              <div className="sr-only" aria-hidden>
                <ConnectWallet size="small" />
              </div>
              <Header />
              <main className="grow">
                {children}
              </main>
            </div>
          </WalletRefProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Theme>
  )
}
