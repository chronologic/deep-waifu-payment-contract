import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import toml from "toml";
import fs from "fs";

const CLUSTER = process.env.CLUSTER;

const apiUrl = (() => {
  try {
    return anchor.web3.clusterApiUrl(CLUSTER as any);
  } catch (e) {
    return "http://localhost:8899";
  }
})();

console.log("API URL is", apiUrl);

const config = toml.parse(
  fs.readFileSync(__dirname + "/../Anchor.toml").toString()
);

createMint();

////////////////////////////////////////////////////////////////

async function createMint() {
  const connection = new anchor.web3.Connection(apiUrl, {
    commitment: "confirmed",
  });
  const keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync(config.provider[CLUSTER].wallet).toString())
    )
  );
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.Provider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const TOKEN_DECIMALS = 8;
  const LAMPORTS_PER_TOKEN = 10 ** TOKEN_DECIMALS;

  const solToAidrop = 3;
  console.log(`airdropping ${solToAidrop} SOL to main wallet...`);
  await airdropSol(wallet.publicKey, solToAidrop);

  console.log("creating mint...");
  const mint = await splToken.Token.createMint(
    provider.connection,
    keypair,
    keypair.publicKey,
    null,
    TOKEN_DECIMALS,
    splToken.TOKEN_PROGRAM_ID
  );
  const mintPubkey = mint.publicKey;

  console.log("getting/creating associated token account for main wallet...");
  const walletTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
    provider.wallet.publicKey
  );

  const tokensToMint = 100_000;
  console.log(`minting ${tokensToMint} tokens to main wallet...`);
  await mint.mintTo(
    walletTokenAccount.address,
    keypair,
    [],
    tokensToMint * LAMPORTS_PER_TOKEN
  );

  const dayBeneficiary = new anchor.web3.PublicKey(
    config.programs[CLUSTER].day_beneficiary
  );

  const dayBeneficiaryTokenAccount =
    await mint.getOrCreateAssociatedAccountInfo(dayBeneficiary);

  console.log("done", {
    mint: mintPubkey.toBase58(),
    wallet: provider.wallet.publicKey.toBase58(),
    walletToken: walletTokenAccount.address.toBase58(),
    dayBeneficiary: dayBeneficiary.toBase58(),
    dayBeneficiaryToken: dayBeneficiaryTokenAccount.address.toBase58(),
  });

  async function airdropSol(pubkey: anchor.web3.PublicKey, sol: number) {
    const airdropTx = await provider.connection.requestAirdrop(
      pubkey,
      Math.ceil(anchor.web3.LAMPORTS_PER_SOL * sol)
    );

    await provider.connection.confirmTransaction(airdropTx);
  }
}

async function getPaymentStoragePdaAddress(programId: anchor.web3.PublicKey) {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("payment-storage"))],
    programId
  );
}
