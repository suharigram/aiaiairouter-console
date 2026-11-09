import { describe, expect, it } from "vitest";
import { chatCompletionSchema } from "@/lib/gateway/validation";

describe("gateway validation", () => {
  it("accepts OpenAI-compatible chat and streaming options", () => {
    const result = chatCompletionSchema.parse({ model: "deepseek/deepseek-flash", messages: [{ role: "user", content: "Hello" }], stream: true, tools: [{ type: "function", function: { name: "weather", parameters: { type: "object" } } }] });
    expect(result.stream).toBe(true);
  });
  it("rejects missing messages, invalid models, and unknown transport fields", () => {
    expect(chatCompletionSchema.safeParse({ model: "x", messages: [] }).success).toBe(false);
    expect(chatCompletionSchema.safeParse({ model: "x", messages: [{ role: "user", content: "hi" }], api_key: "must-not-pass" }).success).toBe(false);
  });
});
