# deep-waifu-payment-contract

This is a part of the [DeepWaifu](https://blog.chronologic.network/no-waifu-no-laifu-we-use-deep-networks-to-draw-your-anime-style-portrait-5fbb0ee6b16a) project.

This repository holds the Solana contract (program) that handles payments for minting the NFTs.

The live version of the dapp can be found [here](https://deepwaifu.chronologic.network/).

## 🗺 Project overview

This project consists of the following repositories:

- https://github.com/chronologic/deep-waifu-ui
- https://github.com/chronologic/deep-waifu-server
- https://github.com/chronologic/deep-waifu-payment-contract (this repository)
- https://github.com/chronologic/deep-waifu-model

## 💽 Installation

Run `npm install`

## 🍬 Metaplex Candy Machine Setup

To create and initialize the (Metaplex Candy Machine)[https://hackmd.io/@levicook/HJcDneEWF] Run

`npm run metaplexBootstrap`

You must ensure you have at least 5 SOL in your wallet to cover the deployment cost. Once the process has finished, it will save create a file called `candyMachine_<candy_machine_id>.json` with all relevant addresses in the main directory. You can then put those in the `.env` file.

## 🚧 Building

Run `anchor build`

Make sure the program ID declared in the `programs/../src/lib.rs` is the same as the key that's used for deployment. The key will be located in `target/deploy/<progra_name>-keypair.json` file. You can check what the current address is by running `solana address -k target/deploy/<program_name>-keypair.json`.

## ✨ Vanity address

If you want a vanity address for the program, you can run `solana-keygen grind --ignore-case --starts-with <desired_prefix>:1` and replace the program keypair with the result.

## 📊 Testing

Run `anchor test`

## 🔗 Deployment

Run `npm run deploy:<cluster>` to deploy the program.

Run `npm run migrate:<cluster>` to initialize and configure the deployed program.
