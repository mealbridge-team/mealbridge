import { cookies } from "next/headers";
import type { Db } from "@/db";
import { drivers, restaurants, shelters, sponsors } from "@/db/schema";
import { eq } from "drizzle-orm";

// Demo sign-in. Each restaurant, driver, shelter and sponsor has its own portal; instead of real
// accounts (out of scope for the hackathon) the visitor picks who they are on /demo and we remember
// it in a cookie. One person at a time, so a portal only ever shows its own work.

export type Role = "restaurant" | "driver" | "shelter" | "sponsor";
export type Persona = { role: Role; id: string };

const COOKIE = "mb_persona";
const ROLES: Role[] = ["restaurant", "driver", "shelter", "sponsor"];

export const PORTAL: Record<Role, string> = { restaurant: "/restaurant", driver: "/driver", shelter: "/shelter", sponsor: "/sponsor" };
export const ROLE_LABEL: Record<Role, string> = { restaurant: "Restaurant", driver: "Volunteer driver", shelter: "Shelter", sponsor: "Sponsor" };

export async function getPersona(): Promise<Persona | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const [role, id] = raw?.split(":") ?? [];
  return ROLES.includes(role as Role) && id ? { role: role as Role, id } : null;
}

/** The signed-in id for this role, or undefined when the visitor is someone else (or no one). */
export async function personaId(role: Role) {
  const p = await getPersona();
  return p?.role === role ? p.id : undefined;
}

export async function setPersona(p: Persona) {
  (await cookies()).set(COOKIE, `${p.role}:${p.id}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
}

export async function clearPersona() {
  (await cookies()).delete(COOKIE);
}

export async function personaName(db: Db, p: Persona): Promise<string | null> {
  const table = { restaurant: restaurants, driver: drivers, shelter: shelters, sponsor: sponsors }[p.role];
  const [row] = await db.select({ name: table.name }).from(table).where(eq(table.id, p.id)).limit(1);
  return row?.name ?? null;
}
