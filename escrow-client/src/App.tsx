import { useState } from 'react'

import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

import { BN } from '@coral-xyz/anchor'

import {
  PublicKey,
  SystemProgram,
} from '@solana/web3.js'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token'

import { getEscrowProgram } from './solana/program'


function toRawAmount(
  value: string,
  decimals: number,
): BN {
  const [whole = '0', fraction = ''] =
    value.split('.')

  if (
    !/^\d+$/.test(whole) ||
    (fraction && !/^\d+$/.test(fraction))
  ) {
    throw new Error('Invalid token amount')
  }

  if (fraction.length > decimals) {
    throw new Error(
      `Token supports only ${decimals} decimal places`,
    )
  }

  const paddedFraction =
    fraction.padEnd(decimals, '0')

  const raw =
    BigInt(whole) *
    10n ** BigInt(decimals) +
    BigInt(paddedFraction || '0')

  return new BN(raw.toString())
}


function App() {
  const { connection } = useConnection()

  const { publicKey } = useWallet()

  const wallet = useAnchorWallet()


  const [receiver, setReceiver] =
    useState('')

  const [senderMint, setSenderMint] =
    useState('')

  const [receiverMint, setReceiverMint] =
    useState('')

  const [senderAmount, setSenderAmount] =
    useState('')

  const [receiverAmount, setReceiverAmount] =
    useState('')
  const [acceptSender, setAcceptSender] =
    useState('')
  const [loadedHolder, setLoadedHolder] =
    useState<any>(null)

  const [loadedHolderPda, setLoadedHolderPda] =
    useState<PublicKey | null>(null)


  async function createTrade() {
    try {
      if (!wallet || !publicKey) {
        throw new Error(
          'Connect Phantom first',
        )
      }

      const program =
        getEscrowProgram(
          connection,
          wallet,
        )

      const receiverKey =
        new PublicKey(receiver)

      const senderMintKey =
        new PublicKey(senderMint)

      const receiverMintKey =
        new PublicKey(receiverMint)

      const senderMintInfo =
        await getMint(
          connection,
          senderMintKey,
        )

      const receiverMintInfo =
        await getMint(
          connection,
          receiverMintKey,
        )

      const senderRawAmount =
        toRawAmount(
          senderAmount,
          senderMintInfo.decimals,
        )

      const receiverRawAmount =
        toRawAmount(
          receiverAmount,
          receiverMintInfo.decimals,
        )

      const [holder] =
        PublicKey.findProgramAddressSync(
          [
            new TextEncoder().encode(
              'ESCROW',
            ),
            publicKey.toBuffer(),
            receiverKey.toBuffer(),
          ],
          program.programId,
        )

      const senderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          publicKey,
        )

      const holderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          holder,
          true,
        )

      const tx =
        await program.methods
          .initializeEscrow(
            senderRawAmount,
            receiverRawAmount,
          )
          .accounts({
            sender: publicKey,
            receiver: receiverKey,

            holder,

            senderMint:
              senderMintKey,

            receiverMint:
              receiverMintKey,

            senderAtas:
              senderAta,

            holderAtas:
              holderAta,

            systemProgram:
              SystemProgram.programId,

            tokenProgram:
              TOKEN_PROGRAM_ID,

            associatedTokenProgram:
              ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .transaction()

      const latest =
        await connection.getLatestBlockhash(
          'processed',
        )

      tx.recentBlockhash =
        latest.blockhash

      tx.feePayer =
        publicKey



      const signedTx =
        await wallet.signTransaction(tx)

      const signature =
        await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: true,
            maxRetries: 20,
          },
        )

      for (let i = 0; i < 40; i++) {
        const result =
          await connection
            .getSignatureStatuses(
              [signature],
              {
                searchTransactionHistory:
                  true,
              },
            )

        const status =
          result.value[0]

        if (status?.err) {
          throw new Error(
            `Transaction failed: ${JSON.stringify(
              status.err,
            )}`,
          )
        }

        if (
          status?.confirmationStatus ===
          'confirmed' ||
          status?.confirmationStatus ===
          'finalized'
        ) {
          return
        }

        await new Promise(
          resolve =>
            setTimeout(resolve, 1000),
        )
      }

      throw new Error(
        'Transaction was not confirmed',
      )
    }

    catch (error: any) {
      alert(
        error?.message ??
        'Failed to create trade',
      )
    }
  }

  async function loadTrade() {
    try {
      if (!wallet || !publicKey) {
        throw new Error(
          'Connect Phantom first',
        )
      }

      const program =
        getEscrowProgram(
          connection,
          wallet,
        )

      const senderKey =
        new PublicKey(acceptSender)

      const [holder] =
        PublicKey.findProgramAddressSync(
          [
            new TextEncoder().encode(
              'ESCROW',
            ),
            senderKey.toBuffer(),
            publicKey.toBuffer(),
          ],
          program.programId,
        )

      const holderAccount =
        await (program.account as any)
          .holder
          .fetch(holder)

      setLoadedHolder(
        holderAccount,
      )

      setLoadedHolderPda(
        holder,
      )
    }

    catch (error: any) {
      setLoadedHolder(null)
      setLoadedHolderPda(null)

      alert(
        error?.message ??
        'Trade not found',
      )
    }
  }

  async function acceptTrade() {
    try {
      if (
        !wallet ||
        !publicKey ||
        !loadedHolder ||
        !loadedHolderPda
      ) {
        throw new Error(
          'Load trade first',
        )
      }

      const program =
        getEscrowProgram(
          connection,
          wallet,
        )

      const senderKey =
        new PublicKey(
          loadedHolder.sender,
        )

      const senderMintKey =
        new PublicKey(
          loadedHolder.senderToken,
        )

      const receiverMintKey =
        new PublicKey(
          loadedHolder.receiverToken,
        )

      const senderReceiverAta =
        getAssociatedTokenAddressSync(
          receiverMintKey,
          senderKey,
        )

      const holderSenderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          loadedHolderPda,
          true,
        )

      const receiverSenderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          publicKey,
        )

      const receiverReceiverAta =
        getAssociatedTokenAddressSync(
          receiverMintKey,
          publicKey,
        )

      const tx =
        await program.methods
          .acceptTrade()
          .accounts({
            receiver:
              publicKey,

            sender:
              senderKey,

            senderMint:
              senderMintKey,

            receiverMint:
              receiverMintKey,

            senderAtar:
              senderReceiverAta,

            holder:
              loadedHolderPda,

            holderAtas:
              holderSenderAta,

            receiverAtas:
              receiverSenderAta,

            receiverAtar:
              receiverReceiverAta,

            systemProgram:
              SystemProgram.programId,

            tokenProgram:
              TOKEN_PROGRAM_ID,

            associatedTokenProgram:
              ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .transaction()

      const latest =
        await connection.getLatestBlockhash(
          'processed',
        )

      tx.recentBlockhash =
        latest.blockhash

      tx.feePayer =
        publicKey

      const signedTx =
        await wallet.signTransaction(tx)

      const signature =
        await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: true,
            maxRetries: 20,
          },
        )

      await waitForTransaction(
        signature,
      )

      setLoadedHolder(null)
      setLoadedHolderPda(null)
    }

    catch (error: any) {
      alert(
        error?.message ??
        'Failed to accept trade',
      )
    }
  }

  async function rejectTrade() {
    try {
      if (
        !wallet ||
        !publicKey ||
        !loadedHolder ||
        !loadedHolderPda
      ) {
        throw new Error(
          'Load trade first',
        )
      }

      const program =
        getEscrowProgram(
          connection,
          wallet,
        )

      const senderKey =
        new PublicKey(
          loadedHolder.sender,
        )

      const senderMintKey =
        new PublicKey(
          loadedHolder.senderToken,
        )

      const senderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          senderKey,
        )

      const holderAta =
        getAssociatedTokenAddressSync(
          senderMintKey,
          loadedHolderPda,
          true,
        )

      const tx =
        await program.methods
          .rejectTrade()
          .accounts({
            sender:
              senderKey,

            receiver:
              publicKey,

            holder:
              loadedHolderPda,

            senderMint:
              senderMintKey,

            senderAtas:
              senderAta,

            holderAtas:
              holderAta,

            systemProgram:
              SystemProgram.programId,

            tokenProgram:
              TOKEN_PROGRAM_ID,

            associatedTokenProgram:
              ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .transaction()

      const latest =
        await connection.getLatestBlockhash(
          'processed',
        )

      tx.recentBlockhash =
        latest.blockhash

      tx.feePayer =
        publicKey

      const signedTx =
        await wallet.signTransaction(tx)

      const signature =
        await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: true,
            maxRetries: 20,
          },
        )

      await waitForTransaction(
        signature,
      )

      setLoadedHolder(null)
      setLoadedHolderPda(null)
    }

    catch (error: any) {
      alert(
        error?.message ??
        'Failed to reject trade',
      )
    }
  }

  async function waitForTransaction(
    signature: string,
  ) {
    for (let i = 0; i < 40; i++) {
      const result =
        await connection
          .getSignatureStatuses(
            [signature],
            {
              searchTransactionHistory:
                true,
            },
          )

      const status =
        result.value[0]

      if (status?.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(
            status.err,
          )}`,
        )
      }

      if (
        status?.confirmationStatus ===
        'confirmed' ||
        status?.confirmationStatus ===
        'finalized'
      ) {
        return
      }

      await new Promise(
        resolve =>
          setTimeout(resolve, 1000),
      )
    }

    throw new Error(
      'Transaction was not confirmed',
    )
  }

  return (
    <div className="page">

      <header className="header">

        <div>
          <h2>Escrow</h2>

          <span className="network">
            Devnet
          </span>
        </div>

        <WalletMultiButton />

      </header>


      <main className="container">

        <section className="card">

          <h1>
            Create Trade
          </h1>

          <p className="description">
            Create a secure token swap
            using Solana escrow.
          </p>


          {publicKey && (
            <div className="wallet-info">

              Connected:

              <span>
                {publicKey.toBase58()}
              </span>

            </div>
          )}


          <label>
            Receiver wallet

            <input
              value={receiver}

              onChange={(e) =>
                setReceiver(
                  e.target.value,
                )
              }

              placeholder=
              "Receiver public key"
            />
          </label>


          <div className="token-box">

            <h3>
              You send
            </h3>


            <label>
              Mint

              <input
                value={senderMint}

                onChange={(e) =>
                  setSenderMint(
                    e.target.value,
                  )
                }

                placeholder=
                "Sender token mint"
              />
            </label>


            <label>
              Amount

              <input
                type="number"

                value={senderAmount}

                onChange={(e) =>
                  setSenderAmount(
                    e.target.value,
                  )
                }

                placeholder=
                "Amount"
              />
            </label>

          </div>


          <div className="swap-arrow">
            ↓
          </div>


          <div className="token-box">

            <h3>
              You receive
            </h3>


            <label>
              Mint

              <input
                value={receiverMint}

                onChange={(e) =>
                  setReceiverMint(
                    e.target.value,
                  )
                }

                placeholder=
                "Receiver token mint"
              />
            </label>


            <label>
              Amount

              <input
                type="number"

                value={receiverAmount}

                onChange={(e) =>
                  setReceiverAmount(
                    e.target.value,
                  )
                }

                placeholder=
                "Amount"
              />
            </label>

          </div>


          <button
            className="create-button"
            disabled={!wallet}
            onClick={createTrade}
          >
            Create Trade
          </button>

        </section>

        <section className="card">

          <h1>
            Trade
          </h1>

          <p className="description">
            Load an escrow trade
            addressed to your wallet.
          </p>

          <label>
            Sender wallet

            <input
              value={acceptSender}

              onChange={(e) =>
                setAcceptSender(
                  e.target.value,
                )
              }

              placeholder=
              "Sender public key"
            />
          </label>

          <button
            className="create-button"
            disabled={!wallet}
            onClick={loadTrade}
          >
            Load Trade
          </button>


          {loadedHolder && (
            <div className="token-box">

              <h3>
                Trade details
              </h3>

              <p>
                Sender:
                {' '}
                {loadedHolder.sender.toString()}
              </p>

              <p>
                Sender mint:
                {' '}
                {loadedHolder.senderToken.toString()}
              </p>

              <p>
                Sender amount:
                {' '}
                {loadedHolder.senderAmount.toString()}
              </p>

              <p>
                Receiver mint:
                {' '}
                {loadedHolder.receiverToken.toString()}
              </p>

              <p>
                Receiver amount:
                {' '}
                {loadedHolder.receiverAmount.toString()}
              </p>


              <button
                className="create-button"
                onClick={acceptTrade}
              >
                Accept Trade
              </button>


              <button
                className="create-button"
                onClick={rejectTrade}
              >
                Reject Trade
              </button>

            </div>
          )}

        </section>

      </main>

    </div>
  )
}


export default App