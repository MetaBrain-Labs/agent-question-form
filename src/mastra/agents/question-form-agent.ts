import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { weatherTool } from "../tools/weather-tool";
import { scorers } from "../scorers/question-form-scorer";
import { DISCOVERY_AND_PHILOSOPHY } from "../prompts/discovery";

export const questionFromAgent = new Agent({
  id: "question-from-agent",
  name: "Question Form Agent",
  instructions: DISCOVERY_AND_PHILOSOPHY,
  model: "deepseek/deepseek-v4-pro",
  tools: { weatherTool },
  scorers: {
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
    completeness: {
      scorer: scorers.completenessScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
    discoveryCompliance: {
      scorer: scorers.discoveryComplianceScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
  },
  memory: new Memory(),
});
