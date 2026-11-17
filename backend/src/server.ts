import { createApp } from "./app";
import { config } from "./lib/config";
import { connect } from "./lib/db";
import { ensureIndexes } from "./models";
import { seed } from "./seed";

connect(config.mongoUri)
  .then(async () => {
    await ensureIndexes();
    // Render's free plan has no shell, so empty collections are filled on start.
    if (process.env.SEED_ON_START !== "false") console.log("Seed on start:", await seed());
    createApp().listen(config.port, () => console.log(`AFN API listening on port ${config.port}`));
  })
  .catch((err) => {
    console.error("Could not start:", err.message);
    process.exit(1);
  });
