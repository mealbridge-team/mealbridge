"use client";

import { useState } from "react";
import { driverDropoff } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass } from "@/components/ui";

type Location = { lat: number; lng: number; simulated: boolean };

export function DropoffForm({ tripId, driverId, shelter }: { tripId: string; driverId: string; shelter: { lat: number; lng: number } }) {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError("This browser can't share location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, simulated: false }),
      () => setError("Couldn't get your location. Check the browser's location permission."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form action={driverDropoff} className="space-y-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="lat" value={location?.lat ?? ""} />
      <input type="hidden" name="lng" value={location?.lng ?? ""} />
      <input type="hidden" name="simulated" value={String(location?.simulated ?? false)} />
      <PhotoInput label="Photo of the food at the shelter" required />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useMyLocation} className={buttonClass.secondary}>
          Use my location
        </button>
        <button
          type="button"
          onClick={() => setLocation({ ...shelter, simulated: true })}
          className={buttonClass.secondary}
          title="For the demo only: pretend the phone is at the shelter"
        >
          Demo: I&apos;m at the shelter
        </button>
      </div>
      {location && (
        <p className="text-xs text-muted">
          {location.simulated ? "Demo location set to the shelter (labelled as simulated)." : "Location captured."}
        </p>
      )}
      {error && <p className="text-xs text-berry">{error}</p>}
      {location ? (
        <SubmitButton pendingText="Checking delivery…" className="w-full">
          Delivered
        </SubmitButton>
      ) : (
        <>
          <p className="text-xs text-muted">
            To finish, tap <strong className="text-ink">Use my location</strong> at the shelter, or{" "}
            <strong className="text-ink">Demo: I&apos;m at the shelter</strong> if you&apos;re trying the demo.
          </p>
          <button type="button" disabled className={`${buttonClass.primary} w-full`}>
            Delivered (needs your location)
          </button>
        </>
      )}
    </form>
  );
}
