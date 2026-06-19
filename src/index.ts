import { Probot } from "probot";

export default (app: Probot) => {
  app.log.info("Lord Wobblie is alive!");

  app.on("push", async (context) => {
    // TODO: React to pushes that add/modify .wobblys/ files
    app.log.info(`Push received on ${context.payload.ref}`);
  });

  app.on("pull_request.opened", async (context) => {
    // TODO: React to PRs that add wobblies
    app.log.info(`PR opened: #${context.payload.pull_request.number}`);
  });

  app.on("pull_request.closed", async (context) => {
    if (context.payload.pull_request.merged) {
      // TODO: Activate wobblies when PRs are merged
      app.log.info(`PR merged: #${context.payload.pull_request.number}`);
    }
  });
};
