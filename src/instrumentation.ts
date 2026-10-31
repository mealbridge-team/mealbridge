// Runs once per server start: bring the database schema up to date before serving requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("@/db");
  await runMigrations();
}
