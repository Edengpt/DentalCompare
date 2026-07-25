import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { get } from "@vercel/blob";

/**
 * AI explanation of a patient's uploaded treatment plan. On-demand only (called
 * from a button), so we pay per click rather than on every page view. The model
 * reads the treatment-plan file directly (PDF or image) and returns a structured
 * result via strict tool use — no fragile free-text JSON parsing.
 *
 * Guardrails live in the system prompt: plain-Hebrew explanations, questions to
 * ask the clinic, explicitly NON-diagnostic, no invented treatments, no prices.
 */
export type TreatmentExplanation = {
  treatments: { name: string; explanation: string }[];
  questions: string[];
  isReadable: boolean;
};

// User-approved model for this feature (quality/cost balance for careful,
// medical-adjacent explanation).
const MODEL = "claude-sonnet-5";

const SYSTEM = `אתה עוזר שמסביר למטופלים בישראל תוכניות טיפול שיניים בשפה פשוטה, חמה וברורה.
הנחיות:
- קרא את המסמך המצורף (תוכנית טיפול שיניים).
- לכל טיפול שמופיע במסמך, החזר שם קצר בעברית והסבר של 1-2 משפטים: מה זה ולמה הוא נדרש. אל תמציא טיפולים שאינם מופיעים במסמך.
- הצע 4-6 שאלות חכמות שכדאי למטופל לשאול את המרפאות (למשל אחריות, חלופות טיפול, מה כלול במחיר, לוחות זמנים).
- אל תיתן אבחנה רפואית, אל תמליץ על טיפול ספציפי, ואל תציין מחירים או טווחי מחיר.
- אם המסמך אינו קריא, ריק, או אינו תוכנית טיפול שיניים — החזר is_readable=false והשאר את הרשימות ריקות.
כתוב הכול בעברית פשוטה.`;

const EXPLAIN_TOOL: Anthropic.Tool = {
  name: "provide_explanation",
  description: "מחזיר הסבר מובנה על תוכנית הטיפול של המטופל.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["is_readable", "treatments", "questions"],
    properties: {
      is_readable: {
        type: "boolean",
        description: "true אם המסמך נקרא כתוכנית טיפול שיניים תקינה",
      },
      treatments: {
        type: "array",
        description: "רשימת הטיפולים שבמסמך עם הסבר לכל אחד",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "explanation"],
          properties: {
            name: { type: "string" },
            explanation: { type: "string" },
          },
        },
      },
      questions: {
        type: "array",
        description: "שאלות שכדאי לשאול את המרפאה",
        items: { type: "string" },
      },
    },
  },
};

/** Downloads the private treatment file and turns it into a Claude content block. */
async function treatmentBlock(url: string): Promise<Anthropic.ContentBlockParam> {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`treatment file fetch failed (status ${result?.statusCode})`);
  }
  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  const data = bytes.toString("base64");
  const contentType = result.blob.contentType ?? "";

  if (contentType.includes("pdf")) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }
  const media_type = contentType.includes("png") ? "image/png" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type, data } };
}

export async function explainTreatment(treatmentFileUrl: string): Promise<TreatmentExplanation> {
  const client = new Anthropic();
  const doc = await treatmentBlock(treatmentFileUrl);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [EXPLAIN_TOOL],
    tool_choice: { type: "tool", name: "provide_explanation" },
    messages: [
      {
        role: "user",
        content: [doc, { type: "text", text: "הסבר לי את תוכנית הטיפול הזו לפי ההנחיות." }],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("model did not return structured output");
  }
  const input = toolUse.input as {
    is_readable?: boolean;
    treatments?: { name: string; explanation: string }[];
    questions?: string[];
  };
  return {
    treatments: input.treatments ?? [],
    questions: input.questions ?? [],
    isReadable: input.is_readable ?? false,
  };
}
