// custom_id on every order: "pool:<poolId>;donor:<donorId>" (donor optional). PayPal echoes it
// back on captures and webhooks, so every dollar in can be traced to the fund it was given to.
export function encodeCustomId(tag: { poolId: string; donorId?: string }) {
  return tag.donorId ? `pool:${tag.poolId};donor:${tag.donorId}` : `pool:${tag.poolId}`;
}

export function decodeCustomId(customId: string): { poolId?: string; donorId?: string } {
  const out: { poolId?: string; donorId?: string } = {};
  for (const part of customId.split(";")) {
    const [key, value] = part.split(":");
    if (key === "pool") out.poolId = value;
    if (key === "donor") out.donorId = value;
  }
  return out;
}
