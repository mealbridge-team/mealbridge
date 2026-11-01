import { generateText, Output } from "ai";
import { z } from "zod";
import { geminiModel, takeAiCall } from "@/ai/model";

const photoCheckSchema = z.object({
  showsFood: z.boolean(),
  consistentWithListing: z.boolean().describe("Roughly the same kind and amount of food as listed"),
  notes: z.string().describe("One short sentence a coordinator can read"),
});
export type PhotoCheck = z.infer<typeof photoCheckSchema>;

// Looks at the drop-off photo next to what was listed. The model can only cast doubt on a
// delivery (sending it to a human); payouts are decided by the rules in services/delivery.ts.
export async function checkDropoffPhoto(
  photo: { data: Uint8Array; mediaType: string },
  listingSummary: string,
): Promise<PhotoCheck | null> {
  if (!(await takeAiCall())) return null;
  try {
    const { output } = await generateText({
      model: geminiModel(),
      system:
        "You check delivery photos for a food-rescue app. Be fair: containers, trays and bags of food count as food. Flag only clear mismatches.",
      output: Output.object({ schema: photoCheckSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Listed: ${listingSummary}. Does this drop-off photo match?` },
            { type: "file", mediaType: photo.mediaType, data: photo.data },
          ],
        },
      ],
    });
    return output;
  } catch (err) {
    console.warn("Drop-off photo check failed; leaving it to the other signals", err);
    return null;
  }
}
