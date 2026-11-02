"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

const MAX_EDGE = 1280;

// Resizes the photo in the browser before upload: faster on mobile data, and small enough for
// Gemini and for storing inline. Falls back to the original file if the browser can't decode it.
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function PhotoInput({ name = "photo", label, required = false }: { name?: string; label: string; required?: boolean }) {
  const hidden = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const small = await shrink(file);
    const transfer = new DataTransfer();
    transfer.items.add(small);
    if (hidden.current) hidden.current.files = transfer.files;
    setPreview(URL.createObjectURL(small));
    setBusy(false);
  }

  return (
    <label className="group block cursor-pointer">
      <input type="file" accept="image/*" capture="environment" className="peer sr-only" onChange={onPick} required={required && !preview} />
      <input ref={hidden} type="file" name={name} className="hidden" />
      {preview ? (
        <span className="relative block overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo" className="h-52 w-full object-cover" />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-bg/95 px-2.5 py-1.5 text-xs font-medium">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Change photo
          </span>
        </span>
      ) : (
        <span className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface text-muted transition-colors group-hover:border-muted peer-focus-visible:border-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/20">
          <Camera className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium text-ink">{busy ? "Preparing photo…" : label}</span>
          <span className="text-xs">Tap to take or choose a photo</span>
        </span>
      )}
    </label>
  );
}
