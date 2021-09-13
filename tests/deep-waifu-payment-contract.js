const anchor = require('@project-serum/anchor');

describe('deep-waifu-payment-contract', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it('Is initialized!', async () => {
    // Add your test here.
    const program = anchor.workspace.DeepWaifuPaymentContract;

    // const myPda = anchor.web3.Keypair.generate();
    const beneficiary = anchor.web3.Keypair.generate();
    // anchor.web3.Keypair.

    // console.log(anchor.Provider.env());

    const provider = anchor.getProvider();

    const [paymentStoragePda, paymentStorageBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode('payment-storage'))],
        program.programId
      );

    console.log({ paymentStoragePda, paymentStorageBump });

    console.log('SIGNER', provider.wallet.publicKey.toBase58());
    console.log('PROGRAM ID', program.programId.toBase58());
    console.log('STORAGE PDA', paymentStoragePda.toBase58());

    // console.log(provider.wallet.payer.publicKey.toBase58());

    const priceLamports = new anchor.BN(12_345_678);
    const maxCount = new anchor.BN(10_000);
    const tx = await program.rpc.initialize(
      priceLamports,
      maxCount,
      paymentStorageBump,
      {
        accounts: {
          myPda: paymentStoragePda,
          payer: provider.wallet.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        // signers: [provider.wallet.payer],
      }
    );
    console.log('Your transaction signature', tx);
  });
});
