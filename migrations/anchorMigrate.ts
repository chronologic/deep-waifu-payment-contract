import * as anchor from "@project-serum/anchor";
import toml from "toml";
import fs from "fs";

import deploy from "./deploy";

const CLUSTER = process.env.CLUSTER as string;

const config = toml.parse(
  fs.readFileSync(__dirname + "/../Anchor.toml").toString()
);

const url = (() => {
  try {
    return anchor.web3.clusterApiUrl(
      CLUSTER === "mainnet" ? "mainnet-beta" : (CLUSTER as any)
    );
  } catch (e) {
    return "http://localhost:8899";
  }
})();

async function main() {
  console.log("Cluster:", CLUSTER);
  console.log("Using RPC URL:", url);

  const preflightCommitment = "recent";
  const connection = new anchor.web3.Connection(url, preflightCommitment);

  const secretKey = JSON.parse(
    fs.readFileSync(config.provider[CLUSTER].wallet, "utf8")
  );

  const keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
  const wallet = new anchor.Wallet(keypair);

  const provider = new anchor.Provider(connection, wallet, {
    preflightCommitment,
    commitment: "recent",
  });

  // Run the user's deploy script.
  deploy(provider);
}
main();
