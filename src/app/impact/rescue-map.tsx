"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { pin } from "@/components/live-map";
import type { MapPlace, MapRoute } from "@/lib/impact-data";

// Every delivered rescue as a line from the restaurant to the shelter, on OpenStreetMap muted to a
// quiet grey (see globals.css) so the routes carry the colour.
// Line weight grows with the number of deliveries; a slow dash runs from kitchen to shelter.
// Confidential shelters arrive here already moved to their area's centre (see lib/impact-data.ts).

export function RescueMap({ places, routes }: { places: MapPlace[]; routes: MapRoute[] }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const byId = new Map(places.map((p) => [p.id, p]));
      const most = Math.max(1, ...routes.map((r) => r.trips));
      for (const r of routes) {
        const a = byId.get(r.from);
        const b = byId.get(r.to);
        if (!a || !b) continue;
        const line: [number, number][] = [[a.lat, a.lng], [b.lat, b.lng]];
        const weight = 3 + (r.trips / most) * 5;
        const label = `${a.name} → ${b.name}: ${r.trips} ${r.trips === 1 ? "delivery" : "deliveries"}, ${r.meals.toLocaleString("en-US")} meals`;
        L.polyline(line, { color: "#0d5a3b", weight, opacity: 0.35, lineCap: "round" }).bindTooltip(label, { sticky: true }).addTo(map);
        L.polyline(line, { color: "#0d5a3b", weight: Math.max(2, weight - 2), opacity: 0.9, lineCap: "round", className: "mb-route-flow", interactive: false }).addTo(map);
      }
      for (const p of places) {
        const marker = p.kind === "restaurant" ? pin(L, "restaurant", "#c2410c", 30) : pin(L, "shelter", "#0d5a3b", 30);
        L.marker([p.lat, p.lng], { icon: marker, keyboard: false })
          .bindTooltip(`${p.name} · ${p.kind === "restaurant" ? "restaurant" : "shelter"}, ${p.area}`)
          .addTo(map);
      }
      if (places.length) map.fitBounds(places.map((p) => [p.lat, p.lng] as [number, number]), { padding: [48, 48], maxZoom: 14 });
      else map.setView([37.81, -122.3], 11);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [places, routes]);

  return (
    <div className="impact-map overflow-hidden rounded-2xl border border-line">
      <div
        ref={box}
        className="h-[360px] w-full sm:h-[460px]"
        role="img"
        aria-label={`Map of ${routes.length} delivery routes between ${places.filter((p) => p.kind === "restaurant").length} restaurants and ${places.filter((p) => p.kind === "shelter").length} shelters around the San Francisco Bay.`}
      />
    </div>
  );
}
