change `Anchor.toml` and `src/.../Cargo.toml` `kebab-case`d program names to `snake_case`

`anchor deploy --provider.cluster devnet`

`anchor migrate --provider.cluster devnet` (see `migrations/deploy.js`)

`solana-keygen grind --ignore-case --starts-with deep:1` - put result in `target/deploy/<programname>-keypair.json` to get a vanity program address

## `The given account is not owned by the executing program`

- `anchor build`
- `solana address -k target/deploy/<programname>-keypair.json`
- update program id in `programs/src/<programname>/lib.rs` with the output
- might also need to update `Anchor.toml`
- `anchor build` again
