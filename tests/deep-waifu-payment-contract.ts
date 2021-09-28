import * as anchor from "@project-serum/anchor";
import * as serumCmn from "@project-serum/common";
import * as splToken from "@solana/spl-token";
import assert from "assert";

describe("deep-waifu-payment-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const provider = anchor.getProvider();
  // set commitment to 'confirmed' so we can query RPC for executed transactions
  provider.opts.commitment = "confirmed";
  (provider.connection as any)._commitment = "confirmed";

  const program = anchor.workspace.DeepWaifuPaymentContract;

  const beneficiary = anchor.web3.Keypair.generate();
  const TOKEN_DECIMALS = 8;
  const LAMPORTS_PER_TOKEN = 10 ** TOKEN_DECIMALS;

  let mint: splToken.Token = null;
  let mintPubkey: anchor.web3.PublicKey = null;
  let payerTokenPubkey: anchor.web3.PublicKey = null;
  let beneficiaryTokenPubkey: anchor.web3.PublicKey = null;

  it("initializes a mint for next tests", async () => {
    const creator = anchor.web3.Keypair.generate();

    await airdropSol(creator.publicKey, 10);

    mint = await splToken.Token.createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      TOKEN_DECIMALS,
      splToken.TOKEN_PROGRAM_ID
    );
    mintPubkey = mint.publicKey;

    const payerTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
      provider.wallet.publicKey
    );
    payerTokenPubkey = payerTokenAccount.address;

    await mint.mintTo(payerTokenPubkey, creator, [], 100 * LAMPORTS_PER_TOKEN);

    const payerTokenAccountAfter = await mint.getOrCreateAssociatedAccountInfo(
      provider.wallet.publicKey
    );

    assert.ok(
      payerTokenAccountAfter.amount.toNumber() / LAMPORTS_PER_TOKEN === 100
    );

    const beneficiaryTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
      beneficiary.publicKey
    );
    beneficiaryTokenPubkey = beneficiaryTokenAccount.address;

    console.log("mint", mintPubkey.toBase58());
    console.log("payerToken", payerTokenPubkey.toBase58());
    console.log("beneficiaryToken", beneficiaryTokenPubkey.toBase58());
  });

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
    });

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    assert.ok(myPdaAccount.priceLamports.toNumber() === 0);
    assert.ok(myPdaAccount.priceDay.toNumber() === 0);
    assert.ok(myPdaAccount.count === 0);
    assert.ok(myPdaAccount.maxCount === 0);
    assert.ok(
      myPdaAccount.beneficiary.toBase58() ===
        anchor.web3.SystemProgram.programId.toBase58()
    );
    assert.ok(
      myPdaAccount.beneficiaryDay.toBase58() ===
        anchor.web3.SystemProgram.programId.toBase58()
    );
    assert.ok(
      myPdaAccount.authority.toBase58() === provider.wallet.publicKey.toBase58()
    );
  });

  it("sets params", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const priceLamports = new anchor.BN(12_345_678);
    const priceDay = new anchor.BN(678_321_333);
    const count = new anchor.BN(1);
    const maxCount = new anchor.BN(10_000);
    const beneficiaryPubkey = beneficiary.publicKey;
    const newAuthorityPubkey = null;

    const tx = await program.rpc.setParams(
      priceLamports,
      priceDay,
      count,
      maxCount,
      beneficiaryPubkey,
      beneficiaryTokenPubkey,
      newAuthorityPubkey,
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
          beneficiary: beneficiaryPubkey,
        },
      }
    );

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    assert.ok(
      myPdaAccount.priceLamports.toNumber() === priceLamports.toNumber()
    );
    assert.ok(myPdaAccount.priceDay.toNumber() === priceDay.toNumber());
    assert.ok(myPdaAccount.count === count.toNumber());
    assert.ok(myPdaAccount.maxCount === maxCount.toNumber());
    assert.ok(
      myPdaAccount.beneficiary.toBase58() === beneficiary.publicKey.toBase58()
    );
    assert.ok(
      myPdaAccount.beneficiaryDay.toBase58() ===
        beneficiaryTokenPubkey.toBase58()
    );
    assert.ok(
      myPdaAccount.authority.toBase58() === provider.wallet.publicKey.toBase58()
    );
  });

  it("does not allow non-authority to set params", async () => {
    const nonAuthority = anchor.web3.Keypair.generate();

    await airdropSol(nonAuthority.publicKey, 1);

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const priceLamports = null;
    const priceDay = null;
    const count = new anchor.BN(111);
    const maxCount = null;
    const beneficiaryPubkey = null;
    const newAuthorityPubkey = null;

    assert.rejects(
      program.rpc.setParams(
        priceLamports,
        priceDay,
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
      )
    );
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

    assert.ok(myPdaAccountAfter.count - myPdaAccountBefore.count === 1);
    assert.ok(
      payerBalanceBefore - payerBalanceAfter ===
        myPdaAccountBefore.priceLamports.toNumber()
    );
    assert.ok(
      beneficiaryBalanceAfter - beneficiaryBalanceBefore ===
        myPdaAccountBefore.priceLamports.toNumber()
    );
  });

  it("does not allow payments for minting to non-beneficiary", async () => {
    const payer = anchor.web3.Keypair.generate();

    await airdropSol(payer.publicKey, 1);

    const nonBeneficiary = anchor.web3.Keypair.generate();

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    assert.rejects(
      program.rpc.payForMint({
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
      })
    );
  });

  it("pays for mint with DAY", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);
    const myPdaAccountBefore = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    const payerTokenAccountBefore = await serumCmn.getTokenAccount(
      program.provider,
      payerTokenPubkey
    );
    const beneficiaryTokenAccountBefore = await serumCmn.getTokenAccount(
      program.provider,
      beneficiaryTokenPubkey
    );

    const tx = await program.rpc.payForMintSpl({
      accounts: {
        myPda: paymentStoragePda,
        payer: provider.wallet.publicKey,
        from: payerTokenPubkey,
        beneficiaryDay: beneficiaryTokenPubkey,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      },
    });

    const txData = await provider.connection.getTransaction(tx);

    const payerTokenAccountAfter = await serumCmn.getTokenAccount(
      program.provider,
      payerTokenPubkey
    );
    const beneficiaryTokenAccountAfter = await serumCmn.getTokenAccount(
      program.provider,
      beneficiaryTokenPubkey
    );

    const myPdaAccountAfter = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    assert.ok(
      payerTokenAccountBefore.amount
        .sub(payerTokenAccountAfter.amount)
        .toNumber() === myPdaAccountBefore.priceDay.toNumber()
    );
    assert.ok(
      beneficiaryTokenAccountAfter.amount
        .sub(beneficiaryTokenAccountBefore.amount)
        .toNumber() === myPdaAccountBefore.priceDay.toNumber()
    );
    assert.ok(myPdaAccountAfter.count - myPdaAccountBefore.count === 1);

    const accountKeys = txData.transaction.message.accountKeys.map((k) =>
      k.toBase58()
    );

    const beneficiaryIndex = accountKeys.findIndex(
      (k) => k === beneficiaryTokenPubkey.toBase58()
    );

    const preTokenBalance = new anchor.BN(
      txData.meta.preTokenBalances.find(
        (b) => b.accountIndex === beneficiaryIndex
      ).uiTokenAmount.amount
    );
    const postTokenBalance = new anchor.BN(
      txData.meta.postTokenBalances.find(
        (b) => b.accountIndex === beneficiaryIndex
      ).uiTokenAmount.amount
    );
    const balanceDiff = postTokenBalance.sub(preTokenBalance);

    assert.ok(
      balanceDiff.toNumber() === myPdaAccountBefore.priceDay.toNumber()
    );
  });

  it("does not allow payments for mint with DAY to non-beneficiary", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const nonBeneficiary = anchor.web3.Keypair.generate();

    assert.rejects(
      program.rpc.payForMintSpl({
        accounts: {
          myPda: paymentStoragePda,
          payer: provider.wallet.publicKey,
          from: payerTokenPubkey,
          beneficiaryDay: nonBeneficiary.publicKey,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
        },
      })
    );
  });

  it("does not allow SOL payment after max count is reached", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const count = new anchor.BN(100);
    const maxCount = new anchor.BN(100);

    const tx = await program.rpc.setParams(
      null, // price sol
      null, // price DAY
      count,
      maxCount,
      null, // beneficiary
      null, // beneficiary DAY
      null, // new authority
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
        },
      }
    );

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    assert.ok(myPdaAccount.count === count.toNumber());
    assert.ok(myPdaAccount.maxCount === maxCount.toNumber());

    const payer = anchor.web3.Keypair.generate();

    await airdropSol(payer.publicKey, 1);

    assert.rejects(
      program.rpc.payForMint({
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
      })
    );
  });

  it("does not allow DAY payment after max count is reached", async () => {
    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    const count = new anchor.BN(100);
    const maxCount = new anchor.BN(100);

    const tx = await program.rpc.setParams(
      null, // price sol
      null, // price DAY
      count,
      maxCount,
      null, // beneficiary
      null, // beneficiary DAY
      null, // new authority
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
        },
      }
    );

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    assert.ok(myPdaAccount.count === count.toNumber());
    assert.ok(myPdaAccount.maxCount === maxCount.toNumber());

    assert.rejects(
      program.rpc.payForMintSpl({
        accounts: {
          myPda: paymentStoragePda,
          payer: provider.wallet.publicKey,
          from: payerTokenPubkey,
          beneficiaryDay: beneficiaryTokenPubkey,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
        },
      })
    );
  });

  async function getPaymentStoragePdaAddress(programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("payment-storage"))],
      programId
    );
  }

  async function airdropSol(pubkey: anchor.web3.PublicKey, sol: number) {
    const airdropTx = await provider.connection.requestAirdrop(
      pubkey,
      Math.ceil(anchor.web3.LAMPORTS_PER_SOL * sol)
    );

    await provider.connection.confirmTransaction(airdropTx);
  }
});
