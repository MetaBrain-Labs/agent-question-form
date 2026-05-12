import { z } from "zod";
import { createToolCallAccuracyScorerCode } from "@mastra/evals/scorers/prebuilt";
import { createCompletenessScorer } from "@mastra/evals/scorers/prebuilt";
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
} from "@mastra/evals/scorers/utils";
import { createScorer } from "@mastra/core/evals";

export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: "weatherTool",
  strictMode: false,
});

export const completenessScorer = createCompletenessScorer();

// Custom LLM-judged scorer: evaluates whether the agent follows DISCOVERY_AND_PHILOSOPHY rules
export const discoveryComplianceScorer = createScorer({
  id: "discovery-compliance-scorer",
  name: "Discovery Compliance",
  description:
    "Evaluates whether the agent follows the DISCOVERY_AND_PHILOSOPHY core directives (form rules, process branching, design philosophy, anti-slop checklist, and 5-dim critique)",
  type: "agent",
  judge: {
    model: "deepseek/deepseek-v4-pro",
    instructions: `You are an expert evaluator of AI design assistants. Your job is to judge whether the assistant's response follows the DISCOVERY_AND_PHILOSOPHY core directives.

Key rules to enforce:
1. RULE 1 — Turn 1 must emit a <question-form id="discovery"> for new projects. No tools, no code, no extended thinking. After </question-form>, the assistant must STOP.
2. RULE 2 — Turn 2 branches on the brand answer: either emit direction form, run brand-spec extraction, or skip to TodoWrite.
3. RULE 3 — After direction/brand is locked, first tool call must be TodoWrite with a 5-10 item plan. Live update todos as work progresses.
4. Design Philosophy — embody the correct specialist persona, use skill seeds + layouts (don't write from scratch), avoid AI-slop, prefer 2-3 variations, show junior-pass early, use oklch() for colors, one accent used at most twice.
5. Anti-AI-slop checklist — no purple gradients, no generic emoji feature icons, no rounded cards with left colored border, no hand-drawn SVG humans, no Inter/Roboto as display face, no invented metrics, no filler copy, no icon next to every heading, no gradient on every background.
6. Step 7 (checklist self-check) and Step 8 (5-dim critique: philosophy / hierarchy / execution / specificity / restraint) are non-negotiable before emitting <artifact>.

Be objective. Return only structured JSON matching the schema.`,
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || "";
    const assistantText = getAssistantMessageFromRunOutput(run.output) || "";
    return { userText, assistantText };
  })
  .analyze({
    description:
      "Evaluate discovery and philosophy compliance across key dimensions",
    outputSchema: z.object({
      formCompliance: z.object({
        hasDiscoveryForm: z
          .boolean()
          .describe("Turn 1 emitted <question-form id='discovery'>"),
        stopsAfterForm: z
          .boolean()
          .describe("No code/tools/narration after </question-form>"),
        formTailored: z
          .boolean()
          .describe("Questions tailored to brief, under ~7 items"),
      }),
      processCompliance: z.object({
        branchesOnBrand: z
          .boolean()
          .describe("Turn 2 correctly branches on brand answer"),
        usesTodoWrite: z
          .boolean()
          .describe("Uses TodoWrite with 5-10 item plan after direction lock"),
        liveUpdatesTodos: z
          .boolean()
          .describe("Marks todos in_progress/completed live"),
      }),
      designPhilosophyCompliance: z.object({
        usesSkillSeed: z
          .boolean()
          .describe("Uses skill's seed template + layouts, not from scratch"),
        antiSlop: z.boolean().describe("Avoids AI-slop checklist items"),
        specialistPersona: z
          .boolean()
          .describe("Embodies correct specialist persona for output type"),
        specificity: z
          .boolean()
          .describe("Real copy, specific values, no filler"),
      }),
      critiqueCompliance: z.object({
        runsChecklist: z
          .boolean()
          .describe("Runs checklist self-check (P0 must pass)"),
        runs5DimCritique: z
          .boolean()
          .describe("Runs 5-dim critique before emitting artifact"),
      }),
      overallScore: z
        .number()
        .min(0)
        .max(1)
        .describe("Weighted overall compliance score"),
      explanation: z
        .string()
        .describe("Concise summary of what passed and what failed"),
    }),
    createPrompt: ({ results }) => `
You are evaluating a design assistant's compliance with DISCOVERY_AND_PHILOSOPHY rules.

User message:
"""
${results.preprocessStepResult.userText}
"""

Assistant response:
"""
${results.preprocessStepResult.assistantText}
"""

Evaluate across these dimensions:

1. **Form Compliance**
   - Did the assistant emit <question-form id="discovery"> on a new project brief?
   - Did it stop immediately after </question-form> (no code, no tools, no "I'll wait")?
   - Were the questions tailored to the brief and kept under ~7 items?

2. **Process Compliance**
   - Did Turn 2 correctly branch on the brand answer (direction form / brand-spec extraction / skip)?
   - Did it use TodoWrite with a 5-10 item plan after direction/brand was locked?
   - Did it live-update todo statuses (in_progress → completed) as work progressed?

3. **Design Philosophy Compliance**
   - Did the design output use the skill's seed template and layouts (not written from scratch)?
   - Did it avoid AI-slop (no purple gradients, no generic emoji icons, no filler copy, no invented metrics)?
   - Did it embody the correct specialist persona (slide designer / interaction designer / brand designer / systems designer)?
   - Was every word and value specific to the brief?

4. **Critique Compliance**
   - Did the assistant run a checklist self-check where P0 items must pass?
   - Did it run the 5-dimensional critique (philosophy / hierarchy / execution / specificity / restraint) before emitting the artifact?

Compute an overallScore between 0 and 1. A perfect follow-every-rule response scores 1.0. Minor deviations score 0.7-0.9. Missing core rules (no form, no TodoWrite, no critique) scores below 0.5.

Return JSON matching the schema exactly.
`,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult;
    if (!r) return 0;
    return Math.max(0, Math.min(1, r.overallScore ?? 0));
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult;
    const dims = [
      `form=${r?.formCompliance?.hasDiscoveryForm ? 1 : 0}`,
      `process=${r?.processCompliance?.usesTodoWrite ? 1 : 0}`,
      `philosophy=${r?.designPhilosophyCompliance?.antiSlop ? 1 : 0}`,
      `critique=${r?.critiqueCompliance?.runs5DimCritique ? 1 : 0}`,
    ].join("/");
    return `Discovery compliance: [${dims}]. Score=${score}. ${r?.explanation ?? ""}`;
  });

export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  discoveryComplianceScorer,
};
