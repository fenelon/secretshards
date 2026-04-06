# SecretShards

Split secrets into shares using Shamir's Secret Sharing. Recover with a threshold of shares. Runs entirely in your browser — nothing is sent to any server.

**https://secretshards.com**

## How it works

Choose a threshold (e.g. 3 of 5) and enter a secret. SecretShards splits it into shares using Shamir's Secret Sharing, a proven cryptographic algorithm trusted since 1979. Any combination of shares meeting the threshold can reconstruct the original — no single share is useful on its own.

## Features

- **Client-side only** — no server, no cookies, no analytics, no tracking
- **Zero dependencies** — plain HTML, CSS, and JavaScript with no frameworks or build tools
- **QR codes** — generate and scan QR codes for easy share transfer
- **Offline mode** — download a single self-contained HTML file
- **Print** — print share cards with QR codes for physical storage

## Development

Serve the directory with any static file server:

```
python3 -m http.server 8000
```

Bundle into a single offline HTML file:

```
./bundle.sh
```

Run tests by opening `tests/sss.test.html` in a browser.

## License

By [Ellin Pino](https://ellin.co). QR code generation and scanning by [paulmillr-qr](https://github.com/paulmillr/qr) (MIT license).
