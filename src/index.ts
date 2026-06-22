import { Probot } from "probot";
import { triageIssue } from "./triage";

export default (app: Probot) => {
  app.log.info("The Duke of Wobblie is alive!");

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

  app.on("push", async (context) => {
    app.log.info(`Push received on ${context.payload.ref}`);
  });

  app.on("pull_request.opened", async (context) => {
    app.log.info(`PR opened: #${context.payload.pull_request.number}`);
  });

  app.on("pull_request.closed", async (context) => {
    if (context.payload.pull_request.merged) {
      app.log.info(`PR merged: #${context.payload.pull_request.number}`);
    }
  });
};
