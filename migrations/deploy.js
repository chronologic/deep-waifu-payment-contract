// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const anchor = require("@project-serum/anchor");
const { LAMPORTS_PER_SOL } = require("@solana/web3.js");

const idl = require("../target/idl/deep_waifu_payment_contract.json");

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  provider.opts.commitment = "confirmed";
  provider.connection._commitment = "confirmed";

  const program = new anchor.Program(idl, idl.metadata.address, provider);

  await initialize();
  await setParams();

  //////////////////////

  async function initialize() {
    console.log("initializing...");

    console.log(program.programId.toBase58());

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    console.log(paymentStoragePda.toBase58(), paymentStorageBump);

    const tx = await program.rpc.initialize(paymentStorageBump, {
      accounts: {
        myPda: paymentStoragePda,
        authority: provider.wallet.publicKey,
        // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [provider.wallet.payer],
    });

    console.log("init tx", tx);

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    console.log("initialized", myPdaAccount);
  }

  async function setParams() {
    console.log("setting params...");

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const priceLamports = new anchor.BN(Math.ceil(LAMPORTS_PER_SOL * 0.5));
    const count = new anchor.BN(1);
    const maxCount = new anchor.BN(1_000);
    const beneficiaryPubkey = provider.wallet.publicKey;
    const newAuthorityPubkey = null;

    const tx = await program.rpc.setParams(
      priceLamports,
      count,
      maxCount,
      beneficiaryPubkey,
      newAuthorityPubkey,
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
          beneficiary: beneficiaryPubkey,
        },
        signers: [provider.wallet.payer],
      }
    );

    console.log("set params tx", tx);

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    console.log("params set", myPdaAccount);
  }
};

async function getPaymentStoragePdaAddress(programId) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("payment-storage"))],
    programId
  );
}
