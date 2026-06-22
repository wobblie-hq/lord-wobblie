# The Duke of Wobblie 🎩🤖

GitHub App bot for [wobblies.ai](https://wobblies.ai) — built with [Probot](https://github.com/probot/probot).

## What it does

The Duke of Wobblie is the issue triage bot for the wobblies.ai platform. It:

- **Triages new issues** — auto-labels by type (bug/feature/docs/question), area (core/engineering/design/integration), and priority
- **Detects duplicates** — comments with links to similar open issues
- Listens for webhook events (pushes, PRs, issues) on repos where it's installed
- Detects changes to `.wobblies/` directory
- Activates wobblies when their definition files are merged to the default branch

## Issue Triage

When a new issue is opened, The Duke will:

1. **Classify type** — bug, enhancement, documentation, or question
2. **Route to area** — core, engineering, design, documentation, marketing, or integration
3. **Set priority** — flags high-priority issues (crashes, security, production down)
4. **Find duplicates** — comments with links to similar open issues

## Setup

```bash
npm install
npm run build
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `APP_ID` — GitHub App ID
- `PRIVATE_KEY` — GitHub App private key
- `WEBHOOK_SECRET` — GitHub webhook secret

## Deployment

This app is designed to run on Vercel or any Node.js hosting platform.

## License

[ISC](LICENSE)
