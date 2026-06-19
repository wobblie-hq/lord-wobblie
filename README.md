# Lord Wobblie 🤖

GitHub App bot for [wobblies.ai](https://wobblies.ai) — built with [Probot](https://github.com/probot/probot).

## What it does

Lord Wobblie is the GitHub App that powers wobblies.ai. It:

- Listens for webhook events (pushes, PRs) on repos where it's installed
- Detects changes to `.wobblys/` directory
- Activates wobblies when their definition files are merged to the default branch
- Executes wobbly routines based on watch conditions and schedules

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
