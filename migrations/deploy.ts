import * as anchor from "@project-serum/anchor";
import * as serumCmn from "@project-serum/common";
import * as splToken from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import toml from "toml";
import fs from "fs";

import idl from "../target/idl/deep_waifu_payment_contract.json";

const CLUSTER = process.env.CLUSTER;

const config = toml.parse(
  fs.readFileSync(__dirname + "/../Anchor.toml").toString()
);

export = async function (provider: anchor.Provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  provider.opts.commitment = "confirmed";
  (provider.connection as any)._commitment = "confirmed";

  const program = new anchor.Program(
    idl as any,
    idl.metadata.address,
    provider
  );

  const TOKEN_DECIMALS = 8;
  const LAMPORTS_PER_TOKEN = 10 ** TOKEN_DECIMALS;

  const mint = new anchor.web3.PublicKey(config.programs[CLUSTER].mint);
  const dayBeneficiary = new anchor.web3.PublicKey(
    config.programs[CLUSTER].day_beneficiary
  );

  const dayBeneficiaryToken = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    mint,
    dayBeneficiary,
    false
  );

  console.log("dayBeneficiaryToken", dayBeneficiaryToken.toBase58());

  await initialize();
  await setParams();

  //////////////////////

  async function initialize() {
    console.log("initializing...");

    console.log("program", program.programId.toBase58());

    const [paymentStoragePda, paymentStorageBump] =
      await getPaymentStoragePdaAddress(program.programId);

    console.log(
      "paymentStoragePda",
      paymentStoragePda.toBase58(),
      paymentStorageBump
    );

    const tx = await program.rpc.initialize(paymentStorageBump, {
      accounts: {
        myPda: paymentStoragePda,
        authority: provider.wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
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
    const priceDay = new anchor.BN(Math.ceil(LAMPORTS_PER_TOKEN * 100));
    const count = new anchor.BN(0);
    const maxCount = new anchor.BN(1_000);
    const beneficiaryPubkey = provider.wallet.publicKey;
    const beneficiaryDayPubkey = provider.wallet.publicKey;
    const newAuthorityPubkey = null;

    const tx = await program.rpc.setParams(
      priceLamports,
      priceDay,
      count,
      maxCount,
      beneficiaryPubkey,
      beneficiaryDayPubkey,
      newAuthorityPubkey,
      {
        accounts: {
          myPda: paymentStoragePda,
          authority: provider.wallet.publicKey,
          beneficiary: beneficiaryPubkey,
        },
      }
    );

    console.log("set params tx", tx);

    const myPdaAccount = await program.account.paymentStorage.fetch(
      paymentStoragePda
    );

    console.log("params set", myPdaAccount);
  }
};

async function getPaymentStoragePdaAddress(programId: anchor.web3.PublicKey) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("payment-storage"))],
    programId
  );
}
