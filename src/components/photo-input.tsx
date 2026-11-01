"use client";

import { useRef, useState } from "react";

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
    <label className="block cursor-pointer">
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} required={required && !preview} />
      <input ref={hidden} type="file" name={name} className="hidden" />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selected photo" className="h-48 w-full rounded-xl object-cover" />
      ) : (
        <span className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-cream text-muted">
          <span className="text-3xl" aria-hidden>📷</span>
          <span className="text-sm font-medium">{busy ? "Preparing photo…" : label}</span>
        </span>
      )}
    </label>
  );
}
