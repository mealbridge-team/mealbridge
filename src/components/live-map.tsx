"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveTrip } from "@/services/tracking";

const BAY_AREA: [number, number] = [37.81, -122.3];
const POLL_MS = 4000;

function pin(L: typeof import("leaflet"), emoji: string, color: string, size: number, extra = "") {
  return L.divIcon({
    className: "",
    html: `<div class="mb-pin ${extra}" style="width:${size}px;height:${size}px;background:${color}">${emoji}</div>`,
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
      L.marker([t.restaurant.lat, t.restaurant.lng], { icon: pin(L, "🍲", "var(--leaf)", 30) })
        .bindTooltip(t.restaurant.name)
        .addTo(layer.current);
      L.marker([t.shelter.lat, t.shelter.lng], { icon: pin(L, "🏠", "var(--sky)", 30) })
        .bindTooltip(t.shelter.confidential ? `${t.shelter.label} (approximate, private address)` : t.shelter.label)
        .addTo(layer.current);
      bounds.push([t.restaurant.lat, t.restaurant.lng], [t.shelter.lat, t.shelter.lng]);
      if (t.driver) {
        L.polyline([[t.driver.lat, t.driver.lng], [target.lat, target.lng]], { color: "#d4502c", weight: 3, dashArray: "6 8", opacity: 0.8 }).addTo(layer.current);
        L.marker([t.driver.lat, t.driver.lng], { icon: pin(L, "🚗", "var(--tomato)", 34, "mb-pin-driver") })
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
      <div className="relative overflow-hidden rounded-2xl border border-line" style={{ height }}>
        <div ref={box} className="h-full w-full" />
        {trips && trips.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] mx-auto w-fit rounded-full bg-paper/95 px-4 py-1.5 text-xs font-semibold text-muted shadow-card">
            No one on the road right now
          </div>
        )}
      </div>
      {trips && trips.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {trips.map((t) => (
            <li key={t.tripId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2">
              <span>
                <strong>{t.driverName}</strong> {t.status === "assigned" ? `heading to ${t.restaurant.name}` : `bringing ${t.portions} portions to ${t.shelter.label}`}
              </span>
              <span className="text-xs text-muted">
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
