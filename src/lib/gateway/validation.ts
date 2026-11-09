import { z } from "zod";

const contentPart = z.object({ type: z.string(), text: z.string().optional(), image_url: z.object({ url: z.string().max(2_000_000) }).optional() }).passthrough();
const message = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string().max(1_000_000), z.array(contentPart).max(100), z.null()]),
  name: z.string().max(100).optional(),
  tool_call_id: z.string().max(200).optional(),
  tool_calls: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
}).passthrough();

export const chatCompletionSchema = z.object({
  model: z.string().min(1).max(200),
  messages: z.array(message).min(1).max(500),
  stream: z.boolean().optional().default(false),
  max_tokens: z.number().int().min(1).max(131_072).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string().max(1000), z.array(z.string().max(1000)).max(4)]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  seed: z.number().int().optional(),
  response_format: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.record(z.string(), z.unknown())).max(128).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  reasoning_effort: z.string().max(30).optional(),
  stream_options: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const usageQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});
