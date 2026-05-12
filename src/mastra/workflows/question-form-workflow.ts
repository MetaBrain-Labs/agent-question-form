import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  captureAgentResponse,
  logCaptureResult,
  type AgentCaptureResult,
} from "../utils/form-parser";

// ─── Step 1: Parse design brief into structured requirements ───
const parseBrief = createStep({
  id: "parse-brief",
  description: "Parse user design brief into structured requirements",
  inputSchema: z.object({
    brief: z.string().describe("User's design brief or project description"),
  }),
  outputSchema: z.object({
    outputType: z.string(),
    platform: z.string(),
    audience: z.string(),
    tone: z.string(),
    brand: z.string(),
    scale: z.string(),
    constraints: z.string(),
    // ─── 捕获结果 ───
    agentReply: z.string(),
    formDetected: z.boolean(),
    formData: z.any().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const agent = mastra?.getAgent("question-from-agent");
    if (!agent) {
      throw new Error("Question form agent not found");
    }

    const prompt = `The user sent a design brief. Skip questions — just build.

Brief: """${inputData.brief}"""

Extract the key design requirements and return them as a JSON object with these exact fields:
{
  "outputType": "what are we making (slide deck, web prototype, app prototype, dashboard, marketing page, etc.)",
  "platform": "primary surface (mobile, desktop, tablet, responsive, fixed canvas)",
  "audience": "who is this for",
  "tone": "visual tone (editorial, modern minimal, playful, tech, luxury, brutalist, soft)",
  "brand": "brand context (pick direction, have spec, match reference)",
  "scale": "rough scope (e.g., 8 slides, 1 landing + 3 sub-pages, 4 mobile screens)",
  "constraints": "any constraints, special requirements, or things to avoid"
}

Return ONLY the JSON object. No prose, no question-form, no code blocks.`;

    const response = await agent.generate([
      { role: "user", content: prompt },
    ]);

    const text = response.text ?? "";

    // ─── 捕获并解析 Agent 响应 ───
    const capture = captureAgentResponse(text);
    logCaptureResult("parse-brief", capture);

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Agent did not return valid JSON requirements");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      outputType: String(parsed.outputType ?? "web prototype"),
      platform: String(parsed.platform ?? "responsive"),
      audience: String(parsed.audience ?? ""),
      tone: String(parsed.tone ?? ""),
      brand: String(parsed.brand ?? "Pick a direction for me"),
      scale: String(parsed.scale ?? ""),
      constraints: String(parsed.constraints ?? ""),
      // ─── 把捕获结果返回 ───
      agentReply: capture.text,
      formDetected: capture.hasQuestionForm,
      formData: capture.questionForm,
    };
  },
});

// ─── Step 2: Generate HTML design artifact ───
const generateArtifact = createStep({
  id: "generate-artifact",
  description: "Generate HTML design artifact based on structured requirements",
  inputSchema: z.object({
    outputType: z.string(),
    platform: z.string(),
    audience: z.string(),
    tone: z.string(),
    brand: z.string(),
    scale: z.string(),
    constraints: z.string(),
  }),
  outputSchema: z.object({
    html: z.string(),
    designNotes: z.string(),
    // ─── 捕获结果 ───
    agentReply: z.string(),
    formDetected: z.boolean(),
    formData: z.any().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error("Requirements not found");
    }

    const agent = mastra?.getAgent("question-from-agent");
    if (!agent) {
      throw new Error("Question form agent not found");
    }

    const prompt = `[form answers — discovery]
The user has already submitted their discovery form answers. Skip the form. Jump straight to RULE 3.

Requirements:
${JSON.stringify(inputData, null, 2)}

Your task:
1. TodoWrite a concise plan (5-10 items).
2. Generate the complete HTML design artifact.
3. Run checklist self-check (P0 must pass).
4. Run 5-dim critique (philosophy / hierarchy / execution / specificity / restraint). Fix anything under 3/5.
5. Emit a single <artifact> containing the final HTML.

Remember: embody the correct specialist persona, use skill seed templates, avoid AI-slop, one accent at most twice.`;

    const response = await agent.generate([
      { role: "user", content: prompt },
    ]);

    const text = response.text ?? "";

    // ─── 捕获并解析 Agent 响应 ───
    const capture = captureAgentResponse(text);
    logCaptureResult("generate-artifact", capture);

    // 如果 Agent 没有返回 artifact 而是返回了 question-form，记录日志
    if (capture.hasQuestionForm && !capture.hasArtifact) {
      console.warn(
        "⚠️ [generate-artifact] Agent returned question-form instead of artifact!"
      );
    }

    // 优先使用 artifact 标签内的内容，否则用完整文本
    const html = capture.artifactHtml ?? text;

    return {
      html,
      designNotes: "Artifact generated via design workflow",
      // ─── 把捕获结果返回 ───
      agentReply: capture.text,
      formDetected: capture.hasQuestionForm,
      formData: capture.questionForm,
    };
  },
});

// ─── Step 3: 5-dimensional self-critique ───
const critiqueArtifact = createStep({
  id: "critique-artifact",
  description: "Run 5-dimensional critique on the generated design artifact",
  inputSchema: z.object({
    html: z.string(),
    designNotes: z.string(),
  }),
  outputSchema: z.object({
    scores: z.object({
      philosophy: z.number(),
      hierarchy: z.number(),
      execution: z.number(),
      specificity: z.number(),
      restraint: z.number(),
    }),
    overall: z.number(),
    summary: z.string(),
    weaknesses: z.array(z.string()),
    // ─── 捕获结果 ───
    agentReply: z.string(),
    formDetected: z.boolean(),
    formData: z.any().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error("Artifact data not found");
    }

    const agent = mastra?.getAgent("question-from-agent");
    if (!agent) {
      throw new Error("Question form agent not found");
    }

    const prompt = `Run a 5-dimensional critique on the following HTML design artifact. Be objective and specific.

HTML Artifact (first 4000 chars):
${inputData.html.slice(0, 4000)}

Score each dimension on a 1-5 scale:
1. Philosophy — does the visual posture match the brief? Or did you drift to a default?
2. Hierarchy — does the eye land in one obvious place per screen? Or is everything competing?
3. Execution — typography, spacing, alignment, contrast. Right or just close?
4. Specificity — is every word, number, image specific to this brief? Or filler/generic?
5. Restraint — one accent used at most twice, one decisive flourish? Or three competing flourishes?

Return ONLY a JSON object with this exact shape:
{
  "scores": {
    "philosophy": 0-5,
    "hierarchy": 0-5,
    "execution": 0-5,
    "specificity": 0-5,
    "restraint": 0-5
  },
  "overall": 0-5,
  "summary": "One-sentence overall assessment",
  "weaknesses": ["Weakness 1", "Weakness 2"]
}

No prose outside the JSON.`;

    const response = await agent.generate([
      { role: "user", content: prompt },
    ]);

    const text = response.text ?? "";

    // ─── 捕获并解析 Agent 响应 ───
    const capture = captureAgentResponse(text);
    logCaptureResult("critique-artifact", capture);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Agent did not return valid critique JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const scores = parsed.scores ?? {};

    return {
      scores: {
        philosophy: Number(scores.philosophy ?? 0),
        hierarchy: Number(scores.hierarchy ?? 0),
        execution: Number(scores.execution ?? 0),
        specificity: Number(scores.specificity ?? 0),
        restraint: Number(scores.restraint ?? 0),
      },
      overall: Number(parsed.overall ?? 0),
      summary: String(parsed.summary ?? ""),
      weaknesses: Array.isArray(parsed.weaknesses)
        ? parsed.weaknesses.map(String)
        : [],
      // ─── 把捕获结果返回 ───
      agentReply: capture.text,
      formDetected: capture.hasQuestionForm,
      formData: capture.questionForm,
    };
  },
});

// ─── Workflow assembly ───
const questionFormWorkflow = createWorkflow({
  id: "design-workflow",
  inputSchema: z.object({
    brief: z.string().describe("User's design brief or project description"),
  }),
  outputSchema: z.object({
    html: z.string(),
    scores: z.object({
      philosophy: z.number(),
      hierarchy: z.number(),
      execution: z.number(),
      specificity: z.number(),
      restraint: z.number(),
    }),
    overall: z.number(),
    summary: z.string(),
    weaknesses: z.array(z.string()),
  }),
})
  .then(parseBrief)
  .then(generateArtifact)
  .then(critiqueArtifact);

questionFormWorkflow.commit();

export { questionFormWorkflow };
