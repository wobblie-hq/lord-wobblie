import { Probot } from "probot";
import { triageIssue } from "./triage";
import { reviewPR } from "./review";

export default (app: Probot) => {
  app.log.info("The Duke of Wobblie is alive! 🎩");

  // Issue triage
  app.on("issues.opened", async (context) => {
    const { title, body, number } = context.payload.issue;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    app.log.info(`Issue opened: #${number} "${title}" on ${owner}/${repo}`);

    try {
      const result = await triageIssue({ title, body: body || "", owner, repo, octokit: context.octokit });

      if (result.labels.length) {
        await context.octokit.rest.issues.addLabels(context.issue({ labels: result.labels }));
      }
      if (result.comment) {
        await context.octokit.rest.issues.createComment(context.issue({ body: result.comment }));
      }

      app.log.info(`Triaged #${number}: labels=[${result.labels}]`);
    } catch (err) {
      app.log.error(`Triage failed for #${number}: ${err}`);
    }
  });

  // PR review
  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    app.log.info(`PR opened: #${pr.number} "${pr.title}" on ${owner}/${repo}`);

    try {
      const { data: diff } = await context.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
        mediaType: { format: "diff" },
      });

      await reviewPR({
        owner,
        repo,
        prNumber: pr.number,
        title: pr.title,
        body: pr.body || "",
        diff: diff as unknown as string,
        octokit: context.octokit,
      });

      app.log.info(`Reviewed PR #${pr.number}`);
    } catch (err) {
      app.log.error(`Review failed for PR #${pr.number}: ${err}`);
    }
  });

  // Also review on new pushes to existing PRs
  app.on("pull_request.synchronize", async (context) => {
    const pr = context.payload.pull_request;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    app.log.info(`PR updated: #${pr.number} on ${owner}/${repo}`);

    try {
      const { data: diff } = await context.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
        mediaType: { format: "diff" },
      });

      await reviewPR({
        owner,
        repo,
        prNumber: pr.number,
        title: pr.title,
        body: pr.body || "",
        diff: diff as unknown as string,
        octokit: context.octokit,
      });

      app.log.info(`Re-reviewed PR #${pr.number}`);
    } catch (err) {
      app.log.error(`Re-review failed for PR #${pr.number}: ${err}`);
    }
  });

  app.on("push", async (context) => {
    app.log.info(`Push received on ${context.payload.ref}`);
  });

  app.on("pull_request.closed", async (context) => {
    if (context.payload.pull_request.merged) {
      app.log.info(`PR merged: #${context.payload.pull_request.number}`);
    }
  });
};
