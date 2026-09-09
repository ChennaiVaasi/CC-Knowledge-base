import test from "node:test";
import assert from "node:assert/strict";
import { buildElaborationPrompt, elaborateWithGemini, extractGeminiText } from "./gemini.js";

test("elaboration prompt preserves key ideas and requests bold chess concepts", () => {
  const prompt = buildElaborationPrompt({
    field: "learningOutcome",
    text: "Use opposition to win the pawn ending.",
    context: { concept: "Opposition", rating: "1000 - 1200", teachingFocus: "King placement" },
  });
  assert.match(prompt, /preserving every key idea/i);
  assert.match(prompt, /\*\*like this\*\*/);
  assert.match(prompt, /Concept: Opposition/);
  assert.match(prompt, /Use opposition to win the pawn ending\./);
});

test("Gemini response extraction joins parts and removes an accidental code fence", () => {
  assert.equal(extractGeminiText({ candidates: [{ content: { parts: [{ text: "```markdown\nUse **opposition**" }, { text: " carefully.\n```" }] } }] }), "Use **opposition** carefully.");
  assert.throws(() => extractGeminiText({ candidates: [] }), /no elaborated text/i);
});

test("Gemini request keeps the API key in a header and returns generated text", async () => {
  let request;
  const text = await elaborateWithGemini(
    { field: "solves", text: "Students guess moves." },
    {
      apiKey: "secret",
      model: "test-model",
      fetchImpl: async (url, init) => {
        request = { url, init };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Use **method of elimination**." }] } }] }) };
      },
    },
  );
  assert.equal(text, "Use **method of elimination**.");
  assert.match(request.url, /test-model:generateContent$/);
  assert.equal(request.init.headers["x-goog-api-key"], "secret");
  assert.doesNotMatch(request.init.body, /secret/);
});
