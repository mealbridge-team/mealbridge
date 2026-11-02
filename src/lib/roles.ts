// The four sides of MealBridge and where each one's portal lives. Plain data, safe in the browser.

export type Role = "restaurant" | "driver" | "shelter" | "sponsor";

export const ROLES: Role[] = ["restaurant", "driver", "shelter", "sponsor"];
export const PORTAL: Record<Role, string> = { restaurant: "/restaurant", driver: "/driver", shelter: "/shelter", sponsor: "/sponsor" };
export const ROLE_LABEL: Record<Role, string> = { restaurant: "Restaurant", driver: "Volunteer driver", shelter: "Shelter", sponsor: "Sponsor" };
