import { llm } from "./llm";

interface ReviewInput {
  owner: string;
  repo: string;
  prNumber: number;
  title: string;
  body: string;
  diff: string;
  octokit: any;
}

const SYSTEM_PROMPT = `You are a senior code reviewer for a TypeScript monorepo SaaS product (wobblies.ai).

Stack: Next.js 16, Hono API, Turborepo, Drizzle ORM, BullMQ, pnpm.
Apps: apps/web (marketing), apps/api (Hono), apps/dashboard, apps/docs.
Packages: packages/core (business logic), packages/ui (React components), packages/db.

Review the PR diff. Focus on:
- Bugs, logic errors, race conditions
- Security issues (injection, auth bypass, leaked secrets)
- Performance problems (N+1 queries, missing indexes, unbounded loops)
- Type safety issues
- Missing error handling
- Breaking API changes

Be concise and actionable. Only comment on real issues, not style preferences.

Return JSON:
{
  "summary": "1-2 sentence overall assessment",
  "verdict": "approve" | "request_changes" | "comment",
  "comments": [
    {
      "file": "path/to/file",
      "line": 42,
      "body": "Issue description and suggestion",
      "severity": "critical" | "warning" | "suggestion"
    }
  ]
}

If the diff is clean, return verdict "approve" with an empty comments array.
Do NOT nitpick formatting, naming conventions, or minor style issues.`;

export async function reviewPR(input: ReviewInput): Promise<void> {
  const { octokit, owner, repo, prNumber, title, body, diff } = input;

  // Truncate diff to avoid token limits (~120k chars ≈ 30k tokens)
  const truncatedDiff = diff.length > 120000 ? diff.slice(0, 120000) + "\n\n[diff truncated]" : diff;

  const result = await llm([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `PR #${prNumber}: ${title}\n\n${body || "No description."}\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\`` },
  ]);

  const review = JSON.parse(result) as {
    summary: string;
    verdict: "approve" | "request_changes" | "comment";
    comments: { file: string; line: number; body: string; severity: string }[];
  };

  // Post inline comments
  const prComments = review.comments.map((c) => ({
    path: c.file,
    line: c.line,
    body: `${c.severity === "critical" ? "🚨" : c.severity === "warning" ? "⚠️" : "💡"} ${c.body}`,
  }));

  const event = review.verdict === "approve" ? "APPROVE" : review.verdict === "request_changes" ? "REQUEST_CHANGES" : "COMMENT";

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body: `🎩 **The Duke's Review**\n\n${review.summary}`,
    event,
    comments: prComments,
  });
}
