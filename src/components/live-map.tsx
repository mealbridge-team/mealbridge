"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveTrip } from "@/services/tracking";

const BAY_AREA: [number, number] = [37.81, -122.3];
const POLL_MS = 4000;

// Small inline icons (Lucide paths) so the pins need no image assets.
const ICON = {
  restaurant: '<path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/>',
  shelter: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  driver: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
};

function pin(L: typeof import("leaflet"), icon: keyof typeof ICON, color: string, size: number, extra = "") {
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[icon]}</svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="mb-pin ${extra}" style="width:${size}px;height:${size}px;background:${color}">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Trips on the road, refreshed every few seconds. `tripIds` narrows it (a shelter sees only its own).
export function LiveMap({ tripIds, height = 320 }: { tripIds?: string[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef(false);
  const [trips, setTrips] = useState<LiveTrip[] | null>(null);
  // A string key keeps the polling effect stable across renders; null means "every trip".
  const filter = tripIds ? tripIds.join(",") : null;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(BAY_AREA, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/live", { cache: "no-store" });
          const json = (await res.json()) as { trips: LiveTrip[] };
          const wanted = filter === null ? null : new Set(filter.split(",").filter(Boolean));
          if (!stop) setTrips(wanted ? json.trips.filter((t) => wanted.has(t.tripId)) : json.trips);
        } catch {
          // Keep the last positions; the next poll will try again.
        }
      }
      if (!stop) timer = window.setTimeout(poll, POLL_MS);
    }
    let timer = window.setTimeout(poll, 0);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [filter]);

  useEffect(() => {
    const L = leaflet.current;
    if (!L || !map.current || !layer.current || !trips) return;
    layer.current.clearLayers();
    const bounds: [number, number][] = [];
    for (const t of trips) {
      const target = t.status === "assigned" ? t.restaurant : t.shelter;
      L.marker([t.restaurant.lat, t.restaurant.lng], { icon: pin(L, "restaurant", "#5b605c", 28) })
        .bindTooltip(t.restaurant.name)
        .addTo(layer.current);
      L.marker([t.shelter.lat, t.shelter.lng], { icon: pin(L, "shelter", "#111412", 28) })
        .bindTooltip(t.shelter.confidential ? `${t.shelter.label} (approximate, private address)` : t.shelter.label)
        .addTo(layer.current);
      bounds.push([t.restaurant.lat, t.restaurant.lng], [t.shelter.lat, t.shelter.lng]);
      if (t.driver) {
        L.polyline([[t.driver.lat, t.driver.lng], [target.lat, target.lng]], { color: "#0d5a3b", weight: 3, dashArray: "6 8", opacity: 0.85 }).addTo(layer.current);
        L.marker([t.driver.lat, t.driver.lng], { icon: pin(L, "driver", "#0d5a3b", 34, "mb-pin-driver") })
          .bindTooltip(`${t.driverName}${t.driver.simulated ? " (simulated drive)" : ""}${t.etaMinutes != null ? ` · ~${t.etaMinutes} min` : ""}`)
          .addTo(layer.current);
        bounds.push([t.driver.lat, t.driver.lng]);
      }
    }
    if (bounds.length && !fitted.current) {
      map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      fitted.current = true;
    }
  }, [trips]);

  const moving = trips?.filter((t) => t.driver) ?? [];
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-line" style={{ height }}>
        <div ref={box} className="h-full w-full" />
        {trips && trips.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] mx-auto w-fit rounded-full bg-bg/95 px-4 py-1.5 text-xs font-medium text-muted shadow">
            No one on the road right now
          </div>
        )}
      </div>
      {trips && trips.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {trips.map((t) => (
            <li key={t.tripId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{t.driverName}</span> {t.status === "assigned" ? `heading to ${t.restaurant.name}` : `bringing ${t.portions} portions to ${t.shelter.label}`}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {t.hidden
                  ? "Arriving (location hidden near a private shelter)"
                  : t.driver
                    ? `~${t.etaMinutes} min${t.driver.simulated ? " · simulated" : ""}`
                    : "Waiting for location"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {moving.some((t) => t.driver?.simulated) && <p className="text-xs text-muted">Simulated drives are labelled; real drivers share their phone&apos;s location.</p>}
    </div>
  );
}
