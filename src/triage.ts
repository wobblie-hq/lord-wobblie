import { llm } from "./llm";

interface TriageInput {
  title: string;
  body: string;
  owner: string;
  repo: string;
  octokit: any;
}

interface TriageResult {
  labels: string[];
  comment: string | null;
}

const TRIAGE_SYSTEM_PROMPT = `You triage GitHub issues for wobblies.ai, a TypeScript monorepo SaaS.

Stack: Next.js 16, Hono API, Turborepo, Drizzle ORM, BullMQ, pnpm.
Apps: apps/web (marketing), apps/api (Hono), apps/dashboard, apps/docs.
Packages: packages/core (business logic), packages/ui (React components), packages/db.

Return JSON:
{
  "type": "bug" | "enhancement" | "documentation" | "question",
  "area": "core" | "engineering" | "design" | "documentation" | "marketing" | "integration" | null,
  "priority": "priority:high" | "priority:medium" | null
}

Rules:
- "bug" = something broken, errors, regressions
- "enhancement" = new feature or improvement
- "documentation" = docs issues, typos, unclear guides
- "question" = asking for help or clarification
- area is based on which part of the codebase is affected
- priority:high = security, data loss, production down, crashes
- priority:medium = degraded functionality, important but not urgent`;

async function classifyWithLLM(title: string, body: string): Promise<string[]> {
  const result = await llm([
    { role: "system", content: TRIAGE_SYSTEM_PROMPT },
    { role: "user", content: `Title: ${title}\n\nBody: ${body || "No description."}` },
  ]);

  const parsed = JSON.parse(result) as { type: string; area: string | null; priority: string | null };
  const labels: string[] = [];
  if (parsed.type) labels.push(parsed.type);
  if (parsed.area) labels.push(parsed.area);
  if (parsed.priority) labels.push(parsed.priority);
  return labels;
}

function classifyWithKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`;
  const labels: string[] = [];

  const TYPE_PATTERNS: Record<string, RegExp[]> = {
    bug: [/bug/i, /broken/i, /crash/i, /error/i, /fail/i, /not working/i, /regression/i, /500/i, /404/i],
    enhancement: [/feature/i, /add support/i, /request/i, /implement/i, /should be able/i],
    documentation: [/docs/i, /typo/i, /documentation/i, /readme/i, /unclear/i],
    question: [/how to/i, /how do/i, /is it possible/i, /\?$/i, /question/i],
  };

  const AREA_PATTERNS: Record<string, RegExp[]> = {
    core: [/packages\/core/i, /drizzle/i, /database/i, /queue/i, /bullmq/i, /redis/i],
    engineering: [/api/i, /apps\/api/i, /hono/i, /endpoint/i, /auth/i, /oauth/i],
    design: [/ui/i, /packages\/ui/i, /component/i, /layout/i, /style/i, /css/i],
    documentation: [/docs/i, /apps\/docs/i, /readme/i, /documentation/i],
    marketing: [/apps\/web/i, /landing/i, /seo/i, /marketing/i],
    integration: [/github app/i, /webhook/i, /integration/i, /mcp/i, /slack/i, /linear/i],
  };

  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) { labels.push(type); break; }
  }
  for (const [area, patterns] of Object.entries(AREA_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) { labels.push(area); break; }
  }
  if ([/crash/i, /data loss/i, /security/i, /production/i, /urgent/i, /critical/i].some((p) => p.test(text))) {
    labels.push("priority:high");
  }

  return labels;
}

async function findDuplicates(input: TriageInput): Promise<{ number: number; title: string }[]> {
  const stopwords = new Set(["the", "this", "that", "with", "from", "have", "been", "when", "does", "not", "are", "for", "and", "but"]);
  const keywords = input.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length >= 3 && !stopwords.has(w));
  if (keywords.length === 0) return [];

  const { data: issues } = await input.octokit.rest.issues.listForRepo({ owner: input.owner, repo: input.repo, state: "open", per_page: 50 });

  return issues
    .filter((issue: any) => !issue.pull_request)
    .map((issue: any) => {
      const issueWords = issue.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      const overlap = keywords.filter((k: string) => issueWords.includes(k)).length;
      return { number: issue.number, title: issue.title, score: overlap / keywords.length };
    })
    .filter((m: any) => m.score >= 0.5)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);
}

export async function triageIssue(input: TriageInput): Promise<TriageResult> {
  let labels: string[];
  try {
    labels = await classifyWithLLM(input.title, input.body);
  } catch {
    labels = classifyWithKeywords(input.title, input.body);
  }

  const duplicates = await findDuplicates(input);
  let comment: string | null = null;

  if (duplicates.length > 0) {
    const dupeList = duplicates.map((d) => `- #${d.number} — ${d.title}`).join("\n");
    comment = `👋 Thanks for opening this issue!\n\n**Possible related issues:**\n${dupeList}\n\nIf one of these covers your case, feel free to close this and add a comment there instead.`;
  }

  return { labels, comment };
}
