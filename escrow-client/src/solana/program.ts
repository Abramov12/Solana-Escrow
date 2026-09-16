import {
  AnchorProvider,
  Program,
  type Idl,
} from '@coral-xyz/anchor'

import type { AnchorWallet } from '@solana/wallet-adapter-react'
import type { Connection } from '@solana/web3.js'

import idl from './escrow.json'

export function getEscrowProgram(
  connection: Connection,
  wallet: AnchorWallet,
) {
  const provider = new AnchorProvider(
  connection,
  wallet,
  {
    commitment: 'finalized',
    preflightCommitment: 'finalized',
  },
)

  return new Program(
    idl as Idl,
    provider,
  )
}