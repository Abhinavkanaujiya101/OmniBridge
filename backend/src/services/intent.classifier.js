/**
 * OmniBridge Semantic Intent Classifier
 * ─────────────────────────────────────────────────────────────────────────────
 * Categorizes incoming raw prompt payloads into one of five canonical task types:
 *   TEXT | MATH | IMAGE_GENERATION | VIDEO_GENERATION | CODE
 *
 * Uses a tiered classification pipeline:
 *   1. Hard keyword/pattern matching  (O(1), zero-latency)
 *   2. Regex heuristics               (O(n) on prompt length)
 *   3. Scoring fallback               (weighted bag-of-words)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/** @typedef {'TEXT'|'MATH'|'IMAGE_GENERATION'|'VIDEO_GENERATION'|'CODE'} TaskType */

// ─── Tier-1: Hard keyword maps (exact phrase, case-insensitive) ───────────────

const HARD_KEYWORDS = {
  VIDEO_GENERATION: [
    'generate a video', 'create a video', 'make a video', 'produce a video',
    'render a video', 'animate a scene', 'generate animation', 'make an animation',
    'video of', 'short film', 'cinematic clip', 'luma', 'luma ai', 'dream machine',
    'dream-machine', 'text to video', 'txt2video', 'video generation'
  ],
  IMAGE_GENERATION: [
    'generate an image', 'create an image', 'make an image', 'draw an image',
    'generate a picture', 'create a picture', 'make a picture', 'picture of',
    'photo of', 'image of', 'draw a', 'draw an', 'paint a', 'paint an',
    'render an image', 'render a', 'illustrate', 'visualize',
    'generate art', 'create art', 'digital art of', 'realistic image',
    'flux image', 'stable diffusion', 'text to image', 'txt2img', 'dalle',
    'midjourney style', 'image generation', 'make a car', 'make bmw',
    'make a logo', 'make a portrait', 'make a photo', 'make a wallpaper',
    'make a banner', 'make a 3d', 'make an art', 'make art', 'make car'
  ],
  CODE: [
    'write a function', 'write a program', 'write code', 'write a script',
    'implement a', 'debug this', 'fix this code', 'explain this code',
    'refactor', 'code snippet', 'write a class', 'create a function',
    'algorithm for', 'write unit tests', 'write tests for',
    'javascript', 'python', 'typescript', 'golang', 'rust', 'java code',
    'sql query', 'bash script', 'shell script', 'dockerfile', 'regex for',
    'how do i code', 'how do i implement', 'binary search tree', 'bst',
    'linked list', 'stack and queue', 'sorting algorithm'
  ],
  MATH: [
    'calculate', 'compute', 'solve', 'what is the integral', 'what is the derivative',
    'find the value', 'evaluate the expression', 'simplify', 'factor',
    'probability of', 'statistics for', 'standard deviation',
    'linear regression', 'matrix multiplication', 'eigenvalue',
    'fourier transform', 'laplace', 'differential equation',
    'prove that', 'mathematical proof', 'limit of', 'sum of series'
  ]
};

// ─── Tier-2: Regex heuristics ─────────────────────────────────────────────────

const REGEX_PATTERNS = {
  VIDEO_GENERATION: [
    /\b(video|animation|animated|cinematic|film|clip|footage)\b.*\b(of|showing|depicting|with)\b/i,
    /\bgenerate\b.*\bvideo\b/i,
    /\btext.?to.?video\b/i
  ],
  IMAGE_GENERATION: [
    /\b(make|draw|paint|create|generate|render|sketch|illustrate)\s+(a|an|the)?\s*(bmw|car|ferrari|lamborghini|vehicle|house|cat|dog|dragon|robot|portrait|landscape|wallpaper|logo|poster|banner|picture|image|photo|drawing|painting|3d|character|avatar|sketch)\b/i,
    /\bmake\s+[\w\s]{1,25}\s+(car|vehicle|bmw|logo|picture|photo|image|art|wallpaper|portrait|drawing|painting|3d)\b/i,
    /\b(picture|photo|image|drawing|painting|illustration|artwork)\s+of\b/i,
    /\b(image|picture|photo|illustration|artwork|drawing|painting|poster|banner|thumbnail)\b.*\b(of|showing|depicting|with|in|on)\b/i,
    /\bgenerate\b.*\b(image|picture|photo|art|graphic)\b/i,
    /\btext.?to.?image\b/i,
    /\b(realistic|photorealistic|hyper.?realistic|8k|4k|hdr)\b/i,
    /\bin the style of\b/i
  ],
  CODE: [
    /```[\w\s]*\n?[\s\S]*```/,                          // fenced code block in prompt
    /\b(write|create|implement|build|code|debug|refactor)\b.*\b(function|script|program|class|algorithm|code|api|backend|frontend|test|unit test|bst|binary search tree)\b/i,
    /\bdef\s+\w+\s*\(/,                                  // Python function definition
    /\bfunction\s+\w+\s*\(/,                             // JS function definition
    /\bclass\s+\w+\s*[{:]/,                              // class definition
    /\bconst\b|\blet\b|\bvar\b/,                         // JS keywords
    /\b(if|else|for|while|return|import|export)\b\s*[\w({]/,
    /^\s*(\/\/|#|--|\*)\s/m,                             // comment lines
    /\b(npm|pip|cargo|go)\s+(install|run|build|test|start)\b/i,
    /\bmake\s+(clean|all|install|build|test)\b/i        // GNU make build target only
  ],
  MATH: [
    /\b\d+[\+\-\*\/\^]\d+\b/,                           // arithmetic expressions
    /\b(integral|derivative|gradient|matrix|vector|tensor|eigenvalue|eigenvalues)\b/i,
    /\b(sin|cos|tan|log|ln|exp|sqrt|lim|sum|prod)\s*[\(\d]/i,
    /=\s*\?|solve\s+for\s+[a-z]/i,
    /\d+\s*[+\-*/^]\s*\d+/,
    /\\frac|\\sum|\\int|\\sqrt/,                         // LaTeX math fragments
    /\b(equation|formula|theorem|lemma|proof|inequality)\b/i
  ]
};

// ─── Tier-3: Weighted bag-of-words scorer ─────────────────────────────────────

const SCORE_VOCAB = {
  VIDEO_GENERATION: ['video', 'animate', 'animation', 'cinematic', 'clip', 'footage', 'scene', 'motion', 'render', 'fps'],
  IMAGE_GENERATION: ['image', 'photo', 'picture', 'draw', 'painting', 'artwork', 'illustration', 'generate', 'portrait', 'landscape'],
  CODE: ['function', 'class', 'variable', 'loop', 'array', 'object', 'method', 'api', 'server', 'database', 'code', 'script', 'program', 'bug', 'error', 'syntax'],
  MATH: ['solve', 'calculate', 'compute', 'equation', 'value', 'sum', 'matrix', 'probability', 'integral', 'proof', 'formula', 'number', 'algebra'],
  TEXT: ['explain', 'describe', 'tell', 'write', 'what', 'how', 'why', 'summarize', 'translate', 'essay', 'paragraph', 'story', 'blog', 'article']
};

// ─── Exported Types ────────────────────────────────────────────────────────────

const TASK_TYPES = ['TEXT', 'MATH', 'IMAGE_GENERATION', 'VIDEO_GENERATION', 'CODE'];

// ─── Core Classification Logic ────────────────────────────────────────────────

/**
 * Classify a raw prompt into a canonical task type.
 *
 * @param {string} prompt - The incoming raw prompt text
 * @returns {{ taskType: TaskType, confidence: number, method: string }}
 */
/**
 * Assess complexity to differentiate casual chat/basic utilities from complex multi-step reasoning.
 *
 * @param {string} prompt
 * @param {TaskType} taskType
 * @returns {{ complexity: 'casual'|'basic'|'complex', temperature: number, preferHeavyModel: boolean }}
 */
function evaluateComplexity(prompt, taskType) {
  const norm = (prompt || '').toLowerCase();
  const isComplexSignal =
    /\b(system architecture|distributed system|microservices|design pattern|deep analytical|security audit|performance benchmark|multi-step reasoning|formal proof|complex refactor)\b/i.test(norm) ||
    (prompt.length > 600 && (taskType === 'CODE' || taskType === 'MATH'));

  if (isComplexSignal) {
    return { complexity: 'complex', temperature: 0.2, preferHeavyModel: true };
  }
  if (taskType === 'CODE' || taskType === 'MATH') {
    return { complexity: 'basic', temperature: 0.2, preferHeavyModel: false };
  }
  return { complexity: 'casual', temperature: 0.7, preferHeavyModel: false };
}

/**
 * Classify a raw prompt into a canonical task type and complexity profile.
 *
 * @param {string} prompt - The incoming raw prompt text
 * @returns {{ taskType: TaskType, confidence: number, method: string, complexity: 'casual'|'basic'|'complex', temperature: number, preferHeavyModel: boolean }}
 */
function classifyIntent(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    const meta = evaluateComplexity(prompt, 'TEXT');
    return { taskType: 'TEXT', confidence: 0.5, method: 'default', ...meta };
  }

  const normalized = prompt.trim().toLowerCase();

  // ── Pre-check: Explicit Coding Signals ──────────────────────────────────
  const hasExplicitCode =
    /\b(write|create|generate|implement|debug|build|code)\b.*\b(code|function|program|script|class|method|algorithm|bst|tree)\b/i.test(normalized) ||
    /\b(in\s+)?(c\+\+|cpp|python|java|javascript|js|c#|golang|rust|typescript|html|css|sql)\b/i.test(normalized) ||
    /\b(function|class|method)\s+(in|to|for|with)\b/i.test(normalized) ||
    /\b(implement|implementation|implementing|recursively|recursion|binary search|linked list|stack|queue|sorting)\b/i.test(normalized) ||
    /\b(write\s+a\s+code|write\s+code|code\s+for)\b/i.test(normalized);

  let rawResult = null;

  if (hasExplicitCode) {
    rawResult = { taskType: 'CODE', confidence: 0.98, method: 'code-priority' };
  } else {
    // ── Tier 1: Hard keyword match ─────────────────────────────────────────
    const tier1Order = ['VIDEO_GENERATION', 'IMAGE_GENERATION', 'CODE', 'MATH'];
    for (const taskType of tier1Order) {
      const keywords = HARD_KEYWORDS[taskType];
      for (const kw of keywords) {
        if (normalized.includes(kw)) {
          rawResult = { taskType, confidence: 0.97, method: 'keyword' };
          break;
        }
      }
      if (rawResult) break;
    }
  }

  if (!rawResult) {
    // ── Tier 2: Regex heuristic match ─────────────────────────────────────────
    const tier2Order = ['VIDEO_GENERATION', 'IMAGE_GENERATION', 'CODE', 'MATH'];
    for (const taskType of tier2Order) {
      const patterns = REGEX_PATTERNS[taskType];
      for (const pattern of patterns) {
        if (pattern.test(prompt)) {
          rawResult = { taskType, confidence: 0.85, method: 'regex' };
          break;
        }
      }
      if (rawResult) break;
    }
  }

  if (!rawResult) {
    // ── Tier 3: Weighted vocabulary scoring ───────────────────────────────────
    const words = normalized.split(/\W+/).filter(Boolean);
    const scores = {};

    for (const taskType of TASK_TYPES) {
      const vocab = SCORE_VOCAB[taskType] || [];
      scores[taskType] = words.reduce((acc, word) => {
        return acc + (vocab.includes(word) ? 1 : 0);
      }, 0);
    }

    const normalized_scores = {};
    for (const taskType of TASK_TYPES) {
      const vocab = SCORE_VOCAB[taskType] || [];
      normalized_scores[taskType] = scores[taskType] / Math.max(vocab.length, 1);
    }

    const topType = Object.entries(normalized_scores).sort(([, a], [, b]) => b - a)[0];
    const topScore = topType[1];

    if (topScore > 0) {
      const confidence = Math.min(0.5 + topScore * 5, 0.82);
      rawResult = { taskType: topType[0], confidence, method: 'scoring' };
    } else {
      rawResult = { taskType: 'TEXT', confidence: 0.6, method: 'default' };
    }
  }

  const meta = evaluateComplexity(prompt, rawResult.taskType);
  return { ...rawResult, ...meta };
}

/**
 * Optimize a prompt for a given task type by injecting task-specific system priming.
 *
 * @param {string} prompt - The original prompt
 * @param {TaskType} taskType - The classified task type
 * @returns {string} - The optimized/augmented prompt
 */
function optimizePrompt(prompt, taskType) {
  const trimmed = (prompt || '').trim();

  const formattingInstruction = `Respond using clean markdown with clear headings (#, ##, ###), bold key terms, structured bullet/numbered lists, and relevant emojis for key section titles and takeaways. Make the response highly visual, readable, and structured.`;

  const templates = {
    TEXT: (p) => `${p}\n\n[Instruction: ${formattingInstruction}]`,
    MATH: (p) => `${p}\n\n[Instruction: Provide step-by-step mathematical reasoning using clear markdown headings with emojis, bold equations, and structured numbered/bullet lists.]`,
    CODE: (p) => `${p}\n\n[Instruction: Provide clean, production-ready code blocks along with concise markdown explanations, section headings with emojis, and bullet points.]`,
    IMAGE_GENERATION: (p) =>
      `${p}, highly detailed, professional quality, sharp focus, vibrant lighting`,
    VIDEO_GENERATION: (p) =>
      `${p}, cinematic quality, smooth motion, high framerate, professional color grading`
  };

  return (templates[taskType] || templates['TEXT'])(trimmed);
}

module.exports = { classifyIntent, optimizePrompt, TASK_TYPES };
