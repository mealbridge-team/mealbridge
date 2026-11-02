"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Navigation, Square } from "lucide-react";
import { driverDropoff, driverPickup } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, smallButton } from "@/components/ui";

type Point = { lat: number; lng: number };
type Sharing = "off" | "gps" | "simulated";

const SEND_EVERY_MS = 3000;
const SIMULATED_DRIVE_MS = 45_000;

// One leg of a job: travel (with live location for the shelter's ETA), a photo, and the button that
// finishes the leg. On the drop-off leg the shared location doubles as proof of arrival, so a driver
// who is sharing (or simulating) the drive doesn't need a separate location step.
export function JobLeg({
  stage,
  tripId,
  driverId,
  from,
  to,
  toLabel,
}: {
  stage: "pickup" | "dropoff";
  tripId: string;
  driverId: string;
  from: Point;
  to: Point;
  toLabel: string;
}) {
  const [sharing, setSharing] = useState<Sharing>("off");
  const [progress, setProgress] = useState(0);
  const [gpsFix, setGpsFix] = useState<Point | null>(null);
  const [atStop, setAtStop] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setSharing("off");
  }

  function shareGps() {
    stop();
    setError(null);
    if (!navigator.geolocation) return setError("This browser can't share location.");
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsFix(p);
        if (Date.now() - last < SEND_EVERY_MS) return;
        last = Date.now();
        void send(p, false);
      },
      () => {
        setError("Location permission was denied. Allow it in your browser, or use the demo drive.");
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    cleanup.current = () => navigator.geolocation.clearWatch(id);
    setSharing("gps");
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
    setSharing("simulated");
  }

  // Where the drop-off is reported from: the phone's GPS, or for a demo drive the destination itself.
  const arrival: (Point & { simulated: boolean }) | null =
    atStop ? { ...atStop, simulated: false } : sharing === "simulated" ? { ...to, simulated: true } : sharing === "gps" && gpsFix ? { ...gpsFix, simulated: false } : null;

  // Demo shortcut: report the phone as already at the destination (labelled as simulated).
  function simulateArrival() {
    stop();
    void send(to, true);
    setSharing("simulated");
    setProgress(100);
  }

  function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) return setError("This browser can't share location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setAtStop({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Couldn't get your location. Check the browser's location permission."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {sharing === "off" ? "Live location is off" : sharing === "gps" ? "Sharing your live location" : `Demo drive to ${toLabel} · ${progress}%`}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {stage === "pickup" ? "The restaurant and coordinator see your ETA." : "The shelter sees your ETA."} Only during this trip.
            </p>
          </div>
          {sharing !== "off" && (
            <button type="button" onClick={stop} className={`${buttonClass.secondary} ${smallButton}`}>
              <Square className="h-3.5 w-3.5" aria-hidden /> Stop
            </button>
          )}
        </div>
        {sharing === "off" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={shareGps} className={`${buttonClass.secondary} ${smallButton}`}>
              <Navigation className="h-4 w-4" aria-hidden /> Share my location
            </button>
            <button type="button" onClick={simulate} className={`${buttonClass.secondary} ${smallButton}`}>
              Demo: simulate the drive
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </div>

      {stage === "pickup" ? (
        <form action={driverPickup} className="space-y-3">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="driverId" value={driverId} />
          <PhotoInput label="Photo of the food at pickup" required />
          <SubmitButton pendingText="Saving…" className="w-full">
            I&apos;ve picked it up
          </SubmitButton>
        </form>
      ) : (
        <form action={driverDropoff} className="space-y-3">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="driverId" value={driverId} />
          <input type="hidden" name="lat" value={arrival?.lat ?? ""} />
          <input type="hidden" name="lng" value={arrival?.lng ?? ""} />
          <input type="hidden" name="simulated" value={String(arrival?.simulated ?? false)} />
          <PhotoInput label="Photo of the food at the shelter" required />
          {arrival ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <LocateFixed className="h-3.5 w-3.5 text-brand" aria-hidden />
              {arrival.simulated ? "Arrival location from the demo drive (labelled as simulated)." : "Arrival location from your phone."}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>We need your location at the shelter to finish.</span>
              <button type="button" onClick={useCurrentLocation} className={`${buttonClass.secondary} ${smallButton}`}>
                Use my location
              </button>
              <button type="button" onClick={simulateArrival} className={`${buttonClass.secondary} ${smallButton}`}>
                Demo: I&apos;m at the shelter
              </button>
            </div>
          )}
          <SubmitButton pendingText="Checking the delivery…" className="w-full" disabled={!arrival}>
            Delivered
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
