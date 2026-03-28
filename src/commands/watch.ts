import { Command } from "commander";
import chalk from "chalk";
import { readAuth } from "../lib/auth";
import { runAutoPair, redeemAndWrite } from "./autopair";

const API_BASE = "https://api.badgerclaw.ai";

export const watchCommand = new Command("watch")
  .description("Watch for bot pair events in real-time (no polling)")
  .action(async () => {
    const auth = readAuth();
    if (!auth) {
      console.log(chalk.yellow("Not logged in."));
      process.exit(1);
    }
    await runAutoPair(false);
    console.log(chalk.green("🔴 Listening for pair events... (Ctrl+C to stop)"));
    // Use require() for eventsource v1 (CJS compatible)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EventSource = require("eventsource") as typeof import("eventsource");
    const es = new EventSource(`${API_BASE}/api/v1/openclaw/events`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    } as any);
    es.onmessage = async (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pair") {
          console.log(chalk.cyan(`\n📱 Pair event received: ${data.bot_name}`));
          await redeemAndWrite(data.pair_code, data.bot_name, data.bot_user_id, false);
        }
      } catch {}
    };
    es.onerror = () => {
      console.log(chalk.dim("  Reconnecting..."));
    };
    await new Promise(() => {});
  });
