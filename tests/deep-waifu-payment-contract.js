const anchor = require("@project-serum/anchor");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("deep-waifu-payment-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const provider = anchor.getProvider();
  // set commitment to 'confirmed' so we can query RPC for executed transactions
  provider.opts.commitment = "confirmed";
  provider.connection._commitment = "confirmed";

  const program = anchor.workspace.DeepWaifuPaymentContract;

  it("gets initialized", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const tx = await program.rpc.initialize(paymentStorageBump, {
      accounts: {
        myPda: paymentStoragePda,
        authority: provider.wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [provider.wallet.payer],
    });

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    expect(myPdaAccount.priceLamports.toString()).to.equal("0");
    expect(myPdaAccount.count).to.equal(0);
    expect(myPdaAccount.maxCount).to.equal(0);
    expect(myPdaAccount.beneficiary.toBase58()).to.equal(
      "11111111111111111111111111111111"
    );
    expect(myPdaAccount.authority.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
  });

  it("sets params", async () => {
    const beneficiary = anchor.web3.Keypair.generate();

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const priceLamports = new anchor.BN(12_345_678);
    const count = new anchor.BN(1);
    const maxCount = new anchor.BN(10_000);
    const beneficiaryPubkey = beneficiary.publicKey;
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

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    expect(myPdaAccount.priceLamports.toString()).to.equal(
      priceLamports.toString()
    );
    expect(myPdaAccount.count).to.equal(count.toNumber());
    expect(myPdaAccount.maxCount).to.equal(maxCount.toNumber());
    expect(myPdaAccount.beneficiary.toBase58()).to.equal(
      beneficiary.publicKey.toBase58()
    );
    expect(myPdaAccount.authority.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
  });

  it("does not allow non-authority to set params", async () => {
    const nonAuthority = anchor.web3.Keypair.generate();

    await airdropSol(nonAuthority.publicKey, 1);

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const priceLamports = null;
    const count = new anchor.BN(111);
    const maxCount = null;
    const beneficiaryPubkey = null;
    const newAuthorityPubkey = null;

    const txPromise = program.rpc.setParams(
      priceLamports,
      count,
      maxCount,
      beneficiaryPubkey,
      newAuthorityPubkey,
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: nonAuthority.publicKey,
        },
        signers: [nonAuthority],
      }
    );

    expect(txPromise).to.eventually.throw();
  });

  it("accepts payments for minting", async () => {
    const payer = anchor.web3.Keypair.generate();

    await airdropSol(payer.publicKey, 1);

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const myPdaAccountBefore = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    const payerBalanceBefore = await provider.connection.getBalance(
      payer.publicKey
    );
    const beneficiaryBalanceBefore = await provider.connection.getBalance(
      myPdaAccountBefore.beneficiary
    );

    const tx = await program.rpc.payForMint({
      accounts: {
        myPda: paymentStoragePda,
        payer: payer.publicKey,
        beneficiary: myPdaAccountBefore.beneficiary,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [payer],
      instructions: [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: myPdaAccountBefore.beneficiary,
          lamports: 0,
        }),
      ],
    });

    const myPdaAccountAfter = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    const payerBalanceAfter = await provider.connection.getBalance(
      payer.publicKey
    );

    const beneficiaryBalanceAfter = await provider.connection.getBalance(
      myPdaAccountBefore.beneficiary
    );

    expect(myPdaAccountAfter.count - myPdaAccountBefore.count).to.equal(1);
    expect(payerBalanceBefore - payerBalanceAfter).to.equal(
      myPdaAccountBefore.priceLamports.toNumber()
    );
    expect(beneficiaryBalanceAfter - beneficiaryBalanceBefore).to.equal(
      myPdaAccountBefore.priceLamports.toNumber()
    );
  });

  it("does not allow payments for minting to non-beneficiary", async () => {
    const payer = anchor.web3.Keypair.generate();

    await airdropSol(payer.publicKey, 1);

    const nonBeneficiary = anchor.web3.Keypair.generate();

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const txPromise = program.rpc.payForMint({
      accounts: {
        myPda: paymentStoragePda,
        payer: payer.publicKey,
        beneficiary: nonBeneficiary.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [payer],
      instructions: [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: nonBeneficiary.publicKey,
          lamports: 0,
        }),
      ],
    });

    expect(txPromise).to.eventually.throw();
  });

  it("does not allow payment after max count is reached", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const count = new anchor.BN(100);
    const maxCount = new anchor.BN(100);

    const tx = await program.rpc.setParams(
      null, // price
      count,
      maxCount,
      null, // beneficiary
      null, // new authority
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
        },
        signers: [provider.wallet.payer],
      }
    );

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    expect(myPdaAccount.count).to.equal(count.toNumber());
    expect(myPdaAccount.maxCount).to.equal(maxCount.toNumber());

    const payer = anchor.web3.Keypair.generate();

    await airdropSol(payer.publicKey, 1);

    const paymentPromise = program.rpc.payForMint({
      accounts: {
        myPda: paymentStoragePda,
        payer: payer.publicKey,
        beneficiary: myPdaAccount.beneficiary,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [payer],
      instructions: [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: myPdaAccount.beneficiary,
          lamports: 0,
        }),
      ],
    });

    expect(paymentPromise).to.eventually.throw();
  });

  async function getPaymentStoragePdaAddress(programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("payment-storage"))],
      programId
    );
  }

  async function airdropSol(pubkey, sol) {
    const airdropTx = await provider.connection.requestAirdrop(
      pubkey,
      Math.ceil(anchor.web3.LAMPORTS_PER_SOL * sol)
    );

    await provider.connection.confirmTransaction(airdropTx);
  }
});
