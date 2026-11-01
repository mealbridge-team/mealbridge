// Runs once per server start: bring the database schema up to date before serving requests,
// and load the demo evening into a brand-new database (first deploy on Render).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb, runMigrations } = await import("@/db");
  const { restaurants } = await import("@/db/schema");
  const db = getDb();
  await runMigrations(db);

  const existing = await db.select({ id: restaurants.id }).from(restaurants).limit(1);
  if (existing.length === 0) {
    const { resetDemoData } = await import("@/db/seed");
    await resetDemoData(db);
    console.log("Empty database: loaded the MealBridge demo data.");
  }
}
