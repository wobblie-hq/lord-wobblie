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

interface FileComment {
  path: string;
  line: number;
  body: string;
  severity: string;
}

const SKIP_PATTERNS = [
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /\.snap$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.ico$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.map$/,
  /^\.env/,
  /generated/i,
  /dist\//,
  /\.d\.ts$/,
];

const PRIORITY_PATTERNS = [
  /auth/i, /middleware/i, /security/i, /migration/i,
  /routes?\.(ts|js)$/, /api\//, /packages\/db/,
  /packages\/core/,
];

interface FileDiff {
  path: string;
  content: string;
  priority: number;
}

function parseDiffIntoFiles(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  const parts = diff.split(/^diff --git /m).filter(Boolean);

  for (const part of parts) {
    const pathMatch = part.match(/^a\/(.+?) b\//);
    if (!pathMatch) continue;

    const path = pathMatch[1];
    if (SKIP_PATTERNS.some((p) => p.test(path))) continue;

    const priority = PRIORITY_PATTERNS.some((p) => p.test(path)) ? 0 : 1;
    files.push({ path, content: `diff --git ${part}`, priority });
  }

  return files.sort((a, b) => a.priority - b.priority);
}

const FILE_REVIEW_PROMPT = `You are a senior code reviewer for a TypeScript monorepo SaaS (wobblies.ai).

Stack: Next.js 16, Hono API, Turborepo, Drizzle ORM, BullMQ, pnpm.

Review this single file diff. Focus on:
- Bugs, logic errors, race conditions
- Security issues (injection, auth bypass, leaked secrets)
- Performance problems (N+1 queries, unbounded loops)
- Type safety issues
- Missing error handling
- Breaking API changes

Return JSON:
{
  "comments": [
    { "line": 42, "body": "Issue and suggestion", "severity": "critical" | "warning" | "suggestion" }
  ]
}

Rules:
- Only flag real issues. No style nitpicks.
- "line" must be a line number from the diff (lines starting with +, using the new file line number).
- Return empty comments array if the file is clean.`;

const SUMMARY_PROMPT = `You are a senior code reviewer. Given these per-file review results for a PR, write a 1-2 sentence overall summary and verdict.

Return JSON:
{ "summary": "...", "verdict": "approve" | "request_changes" | "comment" }

Rules:
- "request_changes" if any critical issues exist
- "comment" if only warnings/suggestions
- "approve" if clean`;

export async function reviewPR(input: ReviewInput): Promise<void> {
  const { octokit, owner, repo, prNumber, title, body, diff } = input;

  const files = parseDiffIntoFiles(diff);
  if (files.length === 0) return;

  // Review files individually, cap at 15 files to control cost
  const filesToReview = files.slice(0, 15);
  const allComments: FileComment[] = [];

  const results = await Promise.allSettled(
    filesToReview.map(async (file) => {
      // Cap per-file diff at 15k chars
      const truncated = file.content.length > 15000 ? file.content.slice(0, 15000) + "\n[truncated]" : file.content;

      const result = await llm([
        { role: "system", content: FILE_REVIEW_PROMPT },
        { role: "user", content: `File: ${file.path}\n\n\`\`\`diff\n${truncated}\n\`\`\`` },
      ]);

      const parsed = JSON.parse(result) as { comments: { line: number; body: string; severity: string }[] };
      return parsed.comments.map((c) => ({ ...c, path: file.path }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allComments.push(...result.value);
    }
  }

  // Get overall verdict
  const summaryInput = filesToReview.map((f) => f.path).join(", ") +
    `\n\nIssues found: ${allComments.length}` +
    `\nCritical: ${allComments.filter((c) => c.severity === "critical").length}` +
    `\nWarnings: ${allComments.filter((c) => c.severity === "warning").length}` +
    `\nSuggestions: ${allComments.filter((c) => c.severity === "suggestion").length}`;

  let summary: string;
  let verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

  if (allComments.length === 0) {
    summary = "Code looks good — no issues found.";
    verdict = "APPROVE";
  } else {
    try {
      const summaryResult = await llm([
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: `PR: ${title}\n\n${summaryInput}` },
      ]);
      const parsed = JSON.parse(summaryResult) as { summary: string; verdict: string };
      summary = parsed.summary;
      verdict = parsed.verdict === "approve" ? "APPROVE" : parsed.verdict === "request_changes" ? "REQUEST_CHANGES" : "COMMENT";
    } catch {
      summary = `Found ${allComments.length} issue(s) across ${filesToReview.length} files.`;
      verdict = allComments.some((c) => c.severity === "critical") ? "REQUEST_CHANGES" : "COMMENT";
    }
  }

  // Post review with inline comments
  const prComments = allComments.map((c) => ({
    path: c.path,
    line: c.line,
    body: `${c.severity === "critical" ? "🚨" : c.severity === "warning" ? "⚠️" : "💡"} ${c.body}`,
  }));

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body: `🎩 **The Duke's Review** (${filesToReview.length} files reviewed)\n\n${summary}`,
    event: verdict,
    comments: prComments,
  });
}
