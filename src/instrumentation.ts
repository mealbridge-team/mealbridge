// Runs once per server start: bring the database schema up to date before serving requests,
// and load the demo evening into a brand-new database (first deploy on Render).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb, runMigrations } = await import("@/db");
  const { restaurants } = await import("@/db/schema");
  const db = getDb();

  // A freshly created Render database can take a moment to accept connections. Without the
  // retry a failed migration leaves the server up but answering every request with a 500.
  for (let attempt = 1; ; attempt++) {
    try {
      await runMigrations(db);
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      const reason = error instanceof Error ? (error.cause ?? error).toString() : String(error);
      console.warn(`Database not ready (attempt ${attempt}/10): ${reason}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  const existing = await db.select({ id: restaurants.id }).from(restaurants).limit(1);
  if (existing.length === 0) {
    const { resetDemoData } = await import("@/db/seed");
    await resetDemoData(db);
    console.log("Empty database: loaded the MealBridge demo data.");
  }
}
