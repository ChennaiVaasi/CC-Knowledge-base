const ALLOWED_FIELDS = new Set(["learningOutcome", "solves"]);

export function buildElaborationPrompt({ field, text, context = {} }) {
  if (!ALLOWED_FIELDS.has(field)) throw new Error("Unsupported teaching detail field");

  const purpose = field === "learningOutcome"
    ? "what this position teaches"
    : "the student weakness this position solves";
  const contextLines = [
    ["Domain", context.domain],
    ["Topic", context.topic],
    ["Concept", context.concept],
    ["Rating band", context.rating],
    ["Teaching focus", context.teachingFocus],
    ["FEN", context.fen],
  ].filter(([, value]) => String(value ?? "").trim()).map(([label, value]) => `${label}: ${value}`);

  return `You are an expert chess educator editing ${purpose}.

Expand the educator's draft into clear, practical teaching detail while preserving every key idea and its original meaning. Do not replace, contradict, or omit any idea. Do not invent moves, variations, or claims that cannot be supported by the supplied context. Use language suitable for the stated rating band.

Wrap every named chess concept or instructional method (for example opposition, triangulation, zugzwang, method of elimination, deflection, or a mating net) in Markdown bold markers, **like this**. Do not bold generic emphasis. Return only the revised text, with no heading, preamble, commentary, or code fence.

Context:
${contextLines.join("\n") || "No additional context supplied."}

Educator's draft:
${text.trim()}`;
}

export function extractGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no elaborated text");
  return text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function elaborateWithGemini(input, { apiKey, model = "gemini-2.5-flash", fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildElaborationPrompt(input) }] }],
        generationConfig: { temperature: 0.25 },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return extractGeminiText(await response.json());
}
