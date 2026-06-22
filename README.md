# The Duke of Wobblie 🎩🤖

LLM-powered GitHub App for [wobblies.ai](https://wobblies.ai) — built with [Probot](https://github.com/probot/probot).

## What it does

The Duke of Wobblie is the issue triage and PR review bot for the wobblies.ai platform.

### Issue Triage

When a new issue is opened, The Duke will:

1. **Classify type** — bug, enhancement, documentation, or question (LLM-powered with keyword fallback)
2. **Route to area** — core, engineering, design, documentation, marketing, or integration
3. **Set priority** — flags high-priority issues (crashes, security, production down)
4. **Find duplicates** — comments with links to similar open issues

### PR Review

When a PR is opened or updated, The Duke will:

1. **Analyze the diff** — sends the full diff to GPT-4o-mini for review
2. **Post inline comments** — bugs, security issues, performance problems, missing error handling
3. **Give a verdict** — approve, request changes, or comment
4. **Skip nitpicks** — only flags real issues, not style preferences

Reviews focus on: bugs, logic errors, security, performance, type safety, missing error handling, and breaking API changes.

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
- `OPENAI_API_KEY` — OpenAI API key (for LLM triage + PR review)

## GitHub App Permissions

- **Issues**: Read & Write (triage labels + comments)
- **Pull Requests**: Read & Write (review comments + verdicts)
- **Contents**: Read (for future wobblie activation)

Subscribe to events: Issues, Pull request, Push

## Deployment

This app is designed to run on Vercel or any Node.js hosting platform.

## Architecture

```
src/
├── index.ts      # Probot event handlers
├── triage.ts     # Issue triage (LLM + keyword fallback)
├── review.ts     # PR review (LLM-powered)
└── llm.ts        # OpenAI client
```

## License

[ISC](LICENSE)
