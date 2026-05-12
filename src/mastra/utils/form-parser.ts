/**
 * Agent 响应捕获与解析工具
 * 用于检测和提取 <question-form>、<artifact> 等结构化标签
 */

export interface QuestionFormData {
  /** question-form 的 id 属性 */
  id: string;
  /** question-form 的 title 属性 */
  title: string;
  /** 解析后的 JSON body（如果解析失败则为原始字符串） */
  body: any;
  /** 原始 body 字符串 */
  rawBody: string;
  /** 完整的匹配文本 */
  fullMatch: string;
}

export interface AgentCaptureResult {
  /** Agent 返回的完整文本 */
  text: string;
  /** 是否包含 <question-form> */
  hasQuestionForm: boolean;
  /** 解析后的 question-form 数据 */
  questionForm?: QuestionFormData;
  /** 是否包含 <artifact> */
  hasArtifact: boolean;
  /** 提取出的 HTML 内容 */
  artifactHtml?: string;
}

/** 单个 Step 的捕获记录 */
export interface StepCapture {
  stepId: string;
  agentReply: string;
  formDetected: boolean;
  formData?: QuestionFormData;
}

/**
 * 从文本中解析 <question-form> 标签
 */
export function parseQuestionForm(text: string): QuestionFormData | null {
  const regex =
    /<question-form\s+id="([^"]*)"\s+title="([^"]*)"\s*>([\s\S]*?)<\/question-form>/;
  const match = text.match(regex);
  if (!match) return null;

  const rawBody = match[3].trim();
  let body: any = rawBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // JSON 解析失败时保留原始字符串
  }

  return {
    id: match[1],
    title: match[2],
    body,
    rawBody,
    fullMatch: match[0],
  };
}

/**
 * 从文本中解析 <artifact> 标签内的 HTML
 */
export function parseArtifact(text: string): string | null {
  const match = text.match(/<artifact>([\s\S]*?)<\/artifact>/);
  return match ? match[1].trim() : null;
}

/**
 * 捕获并解析 Agent 的完整响应
 */
export function captureAgentResponse(text: string): AgentCaptureResult {
  const questionForm = parseQuestionForm(text);
  const artifactHtml = parseArtifact(text);

  return {
    text,
    hasQuestionForm: !!questionForm,
    questionForm: questionForm ?? undefined,
    hasArtifact: !!artifactHtml,
    artifactHtml: artifactHtml ?? undefined,
  };
}

/**
 * 便捷函数：直接打印捕获结果到控制台
 */
export function logCaptureResult(
  stepId: string,
  result: AgentCaptureResult
): void {
  console.log(`\n📡 [${stepId}] Agent 响应捕获结果:`);
  console.log(`   文本长度: ${result.text.length} 字符`);
  console.log(`   包含 question-form: ${result.hasQuestionForm}`);
  console.log(`   包含 artifact: ${result.hasArtifact}`);

  if (result.questionForm) {
    console.log(`   📋 form id: ${result.questionForm.id}`);
    console.log(`   📋 form title: ${result.questionForm.title}`);
    console.log(
      `   📋 body 类型: ${typeof result.questionForm.body === "object" ? "JSON" : "string"}`
    );
  }

  if (result.artifactHtml) {
    console.log(`   🎨 artifact 长度: ${result.artifactHtml.length} 字符`);
  }
}
