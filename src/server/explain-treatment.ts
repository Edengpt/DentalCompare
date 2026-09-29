import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { get } from "@vercel/blob";
import type { Locale } from "@/i18n/config";

/**
 * AI explanation of a patient's uploaded treatment plan. On-demand only (called
 * from a button), so we pay per click rather than on every page view. The model
 * reads the treatment-plan file directly (PDF or image) and returns a structured
 * result via strict tool use — no fragile free-text JSON parsing.
 *
 * Guardrails live in the system prompt: plain-language explanations, questions to
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

/**
 * Instructions are per-language rather than one prompt with a "reply in X" line
 * appended. A model told to write Hebrew produces different phrasing from one
 * writing English natively, and for medical-adjacent copy read by a nervous
 * patient that difference matters more than the token saving.
 *
 * The guardrails are identical in every language: no diagnosis, no recommendation, no
 * prices, and nothing invented that isn't in the document.
 */
const SYSTEM: Record<Locale, string> = {
  he: `אתה עוזר שמסביר למטופלים תוכניות טיפול שיניים בשפה פשוטה, חמה וברורה.
הנחיות:
- קרא את המסמך המצורף (תוכנית טיפול שיניים).
- לכל טיפול שמופיע במסמך, החזר שם קצר בעברית והסבר של 1-2 משפטים: מה זה ולמה הוא נדרש. אל תמציא טיפולים שאינם מופיעים במסמך.
- הצע 4-6 שאלות חכמות שכדאי למטופל לשאול את המרפאות (למשל אחריות, חלופות טיפול, מה כלול במחיר, לוחות זמנים).
- אל תיתן אבחנה רפואית, אל תמליץ על טיפול ספציפי, ואל תציין מחירים או טווחי מחיר.
- אם המסמך אינו קריא, ריק, או אינו תוכנית טיפול שיניים — החזר is_readable=false והשאר את הרשימות ריקות.
כתוב הכול בעברית פשוטה.`,
  en: `You explain dental treatment plans to patients in plain, warm, clear language.
Guidelines:
- Read the attached document (a dental treatment plan).
- For each treatment in the document, return a short name and a 1-2 sentence explanation: what it is and why it is needed. Never invent treatments that do not appear in the document.
- Suggest 4-6 useful questions the patient should ask the clinics (warranty, treatment alternatives, what the price includes, timelines).
- Do not give a medical diagnosis, do not recommend a specific treatment, and do not state prices or price ranges.
- If the document is unreadable, empty, or is not a dental treatment plan, return is_readable=false and leave the lists empty.
Write everything in plain English.`,
  ru: `Вы объясняете пациентам планы стоматологического лечения простым, тёплым и понятным языком.
Правила:
- Прочитайте приложенный документ (план стоматологического лечения).
- Для каждой процедуры из документа верните короткое название и объяснение в 1–2 предложения: что это и зачем это нужно. Никогда не придумывайте процедуры, которых нет в документе.
- Предложите 4–6 полезных вопросов, которые пациенту стоит задать клиникам (гарантия, альтернативы лечения, что входит в цену, сроки).
- Не ставьте диагноз, не рекомендуйте конкретное лечение и не указывайте цены или диапазоны цен.
- Если документ нечитаем, пуст или не является планом стоматологического лечения, верните is_readable=false и оставьте списки пустыми.
Пишите всё на простом русском языке.`,
  fr: `Vous expliquez des plans de traitement dentaire aux patients dans un langage simple, chaleureux et clair.
Consignes :
- Lisez le document joint (un plan de traitement dentaire).
- Pour chaque soin figurant dans le document, renvoyez un nom court et une explication de 1 à 2 phrases : ce que c'est et pourquoi il est nécessaire. N'inventez jamais de soins absents du document.
- Proposez 4 à 6 questions utiles que le patient devrait poser aux cliniques (garantie, alternatives de traitement, ce que comprend le prix, délais).
- Ne posez pas de diagnostic, ne recommandez pas de traitement précis et n'indiquez ni prix ni fourchette de prix.
- Si le document est illisible, vide ou n'est pas un plan de traitement dentaire, renvoyez is_readable=false et laissez les listes vides.
Rédigez tout en français simple.`,
  de: `Sie erklären Patienten zahnärztliche Behandlungspläne in einfacher, freundlicher und klarer Sprache.
Richtlinien:
- Lesen Sie das beigefügte Dokument (einen zahnärztlichen Behandlungsplan).
- Geben Sie für jede Behandlung im Dokument einen kurzen Namen und eine Erklärung in 1–2 Sätzen zurück: was sie ist und warum sie nötig ist. Erfinden Sie niemals Behandlungen, die nicht im Dokument stehen.
- Schlagen Sie 4–6 sinnvolle Fragen vor, die der Patient den Kliniken stellen sollte (Garantie, Behandlungsalternativen, was im Preis enthalten ist, Zeitplan).
- Stellen Sie keine Diagnose, empfehlen Sie keine bestimmte Behandlung und nennen Sie keine Preise oder Preisspannen.
- Wenn das Dokument unlesbar, leer oder kein zahnärztlicher Behandlungsplan ist, geben Sie is_readable=false zurück und lassen Sie die Listen leer.
Schreiben Sie alles in einfachem Deutsch.`,
  zh: `您负责用简单、亲切、清晰的语言向患者解释牙科治疗方案。
要求：
- 阅读附件（一份牙科治疗方案）。
- 对文件中出现的每一项治疗，给出简短名称和 1–2 句解释：它是什么、为什么需要。切勿编造文件中没有的治疗。
- 提出 4–6 个患者值得向诊所询问的问题（如保修、替代方案、价格包含哪些内容、时间安排）。
- 不要做医学诊断，不要推荐具体治疗，也不要给出价格或价格区间。
- 如果文件无法读取、为空或不是牙科治疗方案，返回 is_readable=false，并将列表留空。
全部内容请用简体中文书写。`,
  tr: `Hastalara diş tedavi planlarını sade, sıcak ve anlaşılır bir dille açıklıyorsunuz.
Yönergeler:
- Ekteki belgeyi (bir diş tedavi planı) okuyun.
- Belgede geçen her tedavi için kısa bir ad ve 1-2 cümlelik bir açıklama verin: nedir ve neden gereklidir. Belgede olmayan tedavileri asla uydurmayın.
- Hastanın kliniklere sorması gereken 4-6 faydalı soru önerin (garanti, tedavi alternatifleri, fiyata nelerin dahil olduğu, zaman planı).
- Tıbbi teşhis koymayın, belirli bir tedavi önermeyin ve fiyat ya da fiyat aralığı belirtmeyin.
- Belge okunamıyorsa, boşsa veya bir diş tedavi planı değilse is_readable=false döndürün ve listeleri boş bırakın.
Her şeyi sade bir Türkçeyle yazın.`,
};

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

export async function explainTreatment(
  treatmentFileUrl: string,
  locale: Locale,
): Promise<TreatmentExplanation> {
  const client = new Anthropic();
  const doc = await treatmentBlock(treatmentFileUrl);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM[locale],
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
