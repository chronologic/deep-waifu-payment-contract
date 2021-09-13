const anchor = require('@project-serum/anchor');

describe('deep-waifu-payment-contract', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it('Is initialized!', async () => {
    // Add your test here.
    const program = anchor.workspace.DeepWaifuPaymentContract;

    const storageAccount = anchor.web3.Keypair.generate();
    const beneficiary = anchor.web3.Keypair.generate();

    const provider = anchor.getProvider();

    const tx = await program.rpc.initialize(
      {
        beneficiary: beneficiary.publicKey,
        priceLamports: new anchor.BN(12_345_678),
        maxCount: new anchor.BN(10_000),
      },
      {
        accounts: {
          storageAccount: storageAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [storageAccount],
      }
    );
    console.log('Your transaction signature', tx);
  });
});
