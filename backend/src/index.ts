import { createApp } from "./app";
import { env } from "./config/env";
import { startReminderSchedule } from "./services/reminders";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`CRMS API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startReminderSchedule();
});
