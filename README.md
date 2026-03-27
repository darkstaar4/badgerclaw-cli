# BadgerClaw CLI

One-click bot provisioning for BadgerClaw.

## Install

```bash
npm install -g badgerclaw
```

## Usage

```bash
# Authenticate
badgerclaw login

# Check status
badgerclaw status

# Manage bots
badgerclaw bot create mybot
badgerclaw bot list
badgerclaw bot delete mybot
```

## Development

```bash
npm install
npm run build
node dist/index.js --help
```
