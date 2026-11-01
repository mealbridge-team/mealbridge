"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

type Point = { lat: number; lng: number };
type Mode = "off" | "gps" | "simulated";

const SEND_EVERY_MS = 3000;
const SIMULATED_DRIVE_MS = 45_000;

// Shares the driver's position while a trip is active, so the shelter and coordinator see an ETA.
// "Simulate the drive" moves a labelled fake position from `from` to `to` for demos.
export function LiveShare({ tripId, driverId, from, to, toLabel }: { tripId: string; driverId: string; from: Point; to: Point; toLabel: string }) {
  const [mode, setMode] = useState<Mode>("off");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  async function send(p: Point, simulated: boolean) {
    const res = await fetch(`/api/trips/${tripId}/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, lat: p.lat, lng: p.lng, simulated }),
    }).catch(() => null);
    if (res && res.status === 409) stop();
  }

  function stop() {
    cleanup.current();
    cleanup.current = () => {};
    setMode("off");
  }

  function shareGps() {
    stop();
    setError(null);
    if (!navigator.geolocation) return setError("This browser can't share location.");
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last < SEND_EVERY_MS) return;
        last = Date.now();
        void send({ lat: pos.coords.latitude, lng: pos.coords.longitude }, false);
      },
      () => {
        setError("Location permission was denied. You can still simulate the drive.");
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    cleanup.current = () => navigator.geolocation.clearWatch(id);
    setMode("gps");
  }

  function simulate() {
    stop();
    setError(null);
    const started = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / SIMULATED_DRIVE_MS);
      // A slight curve looks more like a road than a ruler line.
      const bend = Math.sin(t * Math.PI) * 0.004;
      void send({ lat: from.lat + (to.lat - from.lat) * t + bend, lng: from.lng + (to.lng - from.lng) * t - bend }, true);
      setProgress(Math.round(t * 100));
      if (t >= 1) window.clearInterval(id);
    };
    tick();
    const id = window.setInterval(tick, SEND_EVERY_MS);
    cleanup.current = () => window.clearInterval(id);
    setMode("simulated");
  }

  return (
    <div className="rounded-2xl border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {mode === "off" ? "Live location is off" : mode === "gps" ? "Sharing your live location" : `Simulated drive to ${toLabel} · ${progress}%`}
        </p>
        {mode !== "off" && (
          <button type="button" onClick={stop} className="text-xs font-semibold text-muted underline">
            Stop
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">Only while this trip is active. The shelter sees your ETA; nobody sees your location afterwards.</p>
      {mode === "off" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={shareGps} className={buttonClass.secondary}>
            Share my location
          </button>
          <button type="button" onClick={simulate} className={buttonClass.secondary} title="Demo only: moves a labelled fake position along the route">
            Demo: simulate the drive
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-berry">{error}</p>}
    </div>
  );
}
