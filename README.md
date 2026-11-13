# CatDoku

A browser logic puzzle: place one cat in each row, column and colored room. Cats cannot touch, including diagonally. Includes 45 levels from 4x4 to 8x8, a level map, stars, hints and saved progress.

## Run locally

No package install or build step is needed to play. Serve the repository, then open the printed localhost address:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080`. Never commit account passwords or API keys. The Bridge SDK loads from Playgama's CDN. Without a working SDK, the game uses local test mode and browser storage. Rewarded actions are explicitly simulated in that mode; they produce no ad impressions or earnings. Do not use local-mode results to validate real monetization.

## Checks

Node 20 or newer, no npm dependencies:

```sh
npm run check
npm test
```

Tests run an isolated copy of the game with a mocked SDK. They cover ad failure, pause, rewards, late opening and save recovery without generating portal traffic. The levels test independently checks every packaged level has exactly one legal solution. These checks do not replace a Playgama SDK integration test on the intended platform.

## Upload package

```sh
python3 tools/package.py
```

Creates `dist/catdoku-1.2.1.zip` with `index.html` at its root and only the five runtime files. The command prints a SHA-256 fingerprint to identify the exact artifact. Creating the ZIP does not upload, publish or submit anything. Keep the existing live build available for rollback and check portal moderation requirements before release.

## Code map

- `index.html`: screens, UI controls and Bridge SDK script.
- `game.js`: board rules, input, pixel art, progress, audio and SDK wrapper.
- `levels.js`: packaged region maps and solutions. The generator named in its header is not currently included in this repository.
- `style.css`: responsive game styling.
- `playgama-bridge-config.json`: interstitial configuration, unchanged in 1.2.1.

## Ads and progress

Interstitials stay at the existing natural level/menu transitions, after the introductory levels, with the existing minimum interval. Version 1.2.1 does not increase frequency. Rewarded buttons explicitly say "Watch ad" and are hidden when the SDK says rewarded ads are unsupported. A reward requires the SDK's `rewarded` event; closing an ad alone earns nothing.

Ad waits stop blocking the UI if an ad does not open in time. The request remains reserved until the SDK reports closed/failed so that a late ad cannot be mistaken for a second request. If a broken SDK never reports a terminal event, further ads are withheld for that visit; gameplay remains available. This favors safe gameplay over repeated ad attempts.

Progress uses the Bridge storage API when available, otherwise localStorage. There is no separate account system in this game. Damaged field types are discarded individually instead of crashing startup; valid stars, best times and preferences are preserved. Clearing site data can remove locally saved progress.

## SDK references

- [Interstitial integration](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/interstitial.md)
- [Rewarded integration](https://wiki.playgama.com/playgama/bridge-sdk/api/advertisement/rewarded.md)

No license or asset-ownership statement is added here. Repository publication alone does not settle third-party rights.
