import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'


import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'

import App from './App.tsx'

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
)