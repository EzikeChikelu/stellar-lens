# Stellar Lens

A read-only, browser-based developer utility for inspecting public Stellar accounts and transactions through Horizon.

> **Safety by design:** Stellar Lens never asks for a wallet connection, secret key, or signing permission. It only makes read-only requests to public Horizon endpoints.

## Features
- Inspect account public keys on Stellar Public or Testnet.
- View sequence number, ledger metadata, home domain, balances, and the five most recent transactions.
- Inspect transaction hash, success status, source account, ledger, timestamp, fee, operation count, memo, and envelope XDR.
- View a human-readable breakdown of transaction operations.
- View transaction fees in stroops and XLM.
- Open account and transaction records in Stellar Expert on the matching network.
- Copy public keys, transaction hashes, envelope XDR, and asset issuers.
- Validate public keys with `@stellar/stellar-sdk` and identify secret seeds to warn users.
- Automated tests and GitHub Actions checks.

## Requirements
Node.js 22+ and npm.

## Run locally
```bash
npm install
npm run dev
```
Open the URL printed by Vite, normally `http://localhost:5173`.

## Quality checks
```bash
npm run typecheck
npm test
npm run build
```

## How it works
The app makes read-only requests to `https://horizon.stellar.org` (Public) or `https://horizon-testnet.stellar.org` (Testnet). Account lookups call `/accounts/{account_id}`, transaction lookups call `/transactions/{hash}`, and transaction operation summaries call `/transactions/{hash}/operations`. No private keys or wallet permissions are required.

## Security and privacy
- Never paste a secret seed or private key into a website or issue.
- The app does not sign or submit transactions.
- Lookup values are sent only to the selected Horizon endpoint to request public chain data.
- This is an informational developer tool, not a wallet, auditor, or financial-advice product.

## Contributing
Good first contributions include mocked Horizon integration tests, clearer summaries for less-common operation types, custom Horizon endpoints, accessible keyboard/screen-reader flows, and browser end-to-end tests. Please include reproduction steps and test evidence in bug reports and pull requests.

## Roadmap
- [ ] Add mocked integration tests for Horizon responses and errors.
- [ ] Allow custom Horizon endpoints.
- [ ] Add browser end-to-end and accessibility tests.
- [ ] Add pagination for transactions with more than 100 operations.

## License
MIT. See [LICENSE](LICENSE).
