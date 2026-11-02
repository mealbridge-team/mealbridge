import { connection } from "next/server";
import { getDb } from "@/db";
import { guideState, readGuide } from "@/lib/demo-guide";
import { getPersona } from "@/lib/demo-session";
import { GuideBarView } from "./guide-bar-view";

// The guided rescue's bar, pinned to the bottom of every page while a guide is running. It reads the
// rescue's real status on each render, so it moves on by itself as the judge works through the steps.
export async function GuideBar() {
  await connection();
  const guide = await readGuide();
  if (!guide) return null;
  const [state, persona] = await Promise.all([guideState(getDb(), guide), getPersona()]);
  if (!state) return null;
  return <GuideBarView state={state} persona={persona} />;
}
