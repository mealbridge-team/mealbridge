import type { ReactNode } from "react";
import { connection } from "next/server";
import { Building2, Car, HandHeart, Store, type LucideIcon } from "lucide-react";
import { signInAs } from "@/app/actions";
import { getDb } from "@/db";
import { sponsors as sponsorsTable } from "@/db/schema";
import { getPersona, type Role } from "@/lib/demo-session";
import { allDrivers, allRestaurants, allShelters } from "@/lib/queries";
import { AREA_LABEL, Empty } from "@/components/ui";
import { PersonaButton } from "./persona-button";

// The people you can sign in as, by role: on /demo all four, and on a portal page just its own.

type Person = { id: string; name: string; detail: string };

const ROLE_INFO: Record<Role, { icon: LucideIcon; title: string; blurb: string }> = {
  restaurant: { icon: Store, title: "Restaurants", blurb: "Post tonight's surplus in one note or photo." },
  driver: { icon: Car, title: "Volunteer drivers", blurb: "Pick up, drop off, get reimbursed by PayPal." },
  shelter: { icon: HandHeart, title: "Shelters and NGOs", blurb: "See food arriving and confirm with one tap." },
  sponsor: { icon: Building2, title: "Sponsors and grants", blurb: "Fund rescues through PayPal invoices." },
};

async function peopleFor(role: Role): Promise<Person[]> {
  const db = getDb();
  if (role === "restaurant")
    return (await allRestaurants(db)).map((r) => ({ id: r.id, name: r.name, detail: `${AREA_LABEL[r.area]} · ${r.plan === "compliance" ? "Compliance plan" : "Free"}` }));
  if (role === "driver") return (await allDrivers(db)).map((d) => ({ id: d.id, name: d.name, detail: `${d.vehicle} · ${AREA_LABEL[d.area]}` }));
  if (role === "shelter") return (await allShelters(db)).map((s) => ({ id: s.id, name: s.name, detail: s.publicLabel }));
  return (await db.select().from(sponsorsTable).orderBy(sponsorsTable.name)).map((s) => ({ id: s.id, name: s.name, detail: s.kind === "city" ? "City grant" : "Corporate sponsor" }));
}

function RoleColumn({ role, people, currentId }: { role: Role; people: Person[]; currentId?: string }) {
  const { icon: Icon, title, blurb } = ROLE_INFO[role];
  return (
    <section aria-labelledby={`role-${role}`} className="flex flex-col rounded-2xl bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-bg text-brand">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        
      </div>
      <h2 id={`role-${role}`} className="font-display text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mb-5 mt-1 text-sm leading-relaxed text-muted">{blurb}</p>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id}>
            <form action={signInAs.bind(null, role, p.id)}>
              <PersonaButton name={p.name} detail={p.detail} current={p.id === currentId} />
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function AllPeople() {
  await connection();
  const roles: Role[] = ["restaurant", "driver", "shelter", "sponsor"];
  const [lists, persona] = await Promise.all([Promise.all(roles.map(peopleFor)), getPersona()]);
  if (lists[0].length === 0) return <Empty>No demo data yet. Run npm run setup to load it.</Empty>;
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {roles.map((role, i) => (
        <RoleColumn key={role} role={role} people={lists[i]} currentId={persona?.role === role ? persona.id : undefined} />
      ))}
    </div>
  );
}

/** Shown on a portal when nobody of that role is signed in. */
export async function SignInFor({ role }: { role: Role }) {
  const people = await peopleFor(role);
  if (people.length === 0) return <Empty>No demo data yet. Run npm run setup to load it.</Empty>;
  return (
    <div className="mx-auto max-w-md py-10">
      <RoleColumn role={role} people={people} />
      <p className="mt-4 text-center text-sm text-muted">Each portal is private to the person signed in. In this demo, signing in is one click.</p>
    </div>
  );
}

/** A portal page for someone who isn't signed in as that role yet. */
export function PortalSignIn({ role, header }: { role: Role; header: ReactNode }) {
  return (
    <>
      {header}
      <SignInFor role={role} />
    </>
  );
}
