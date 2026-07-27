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
    'video of', 'short film', 'cinematic clip', 'runway', 'gen-2', 'gen-3',
    'text to video', 'txt2video', 'video generation'
  ],
  IMAGE_GENERATION: [
    'generate an image', 'create an image', 'make an image', 'draw an image',
    'generate a picture', 'create a picture', 'make a picture',
    'paint a', 'render an image', 'illustrate', 'visualize',
    'generate art', 'create art', 'digital art of', 'photo of',
    'realistic image', 'flux image', 'stable diffusion', 'text to image',
    'txt2img', 'image of', 'dalle', 'midjourney style', 'image generation'
  ],
  CODE: [
    'write a function', 'write a program', 'write code', 'write a script',
    'implement a', 'debug this', 'fix this code', 'explain this code',
    'refactor', 'code snippet', 'write a class', 'create a function',
    'algorithm for', 'write unit tests', 'write tests for',
    'javascript', 'python', 'typescript', 'golang', 'rust', 'java code',
    'sql query', 'bash script', 'shell script', 'dockerfile', 'regex for',
    'how do i code', 'how do i implement'
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
    /\b(image|picture|photo|illustration|artwork|drawing|painting|poster|banner|thumbnail)\b.*\b(of|showing|depicting|with|in|on)\b/i,
    /\bgenerate\b.*\b(image|picture|photo|art)\b/i,
    /\btext.?to.?image\b/i,
    /\b(realistic|photorealistic|hyper.?realistic|8k|4k|hdr)\b/i,
    /\bin the style of\b/i
  ],
  CODE: [
    /```[\w\s]*\n?[\s\S]*```/,                          // fenced code block in prompt
    /\bdef\s+\w+\s*\(/,                                  // Python function
    /\bfunction\s+\w+\s*\(/,                             // JS function
    /\bclass\s+\w+\s*[{:]/,                              // class definition
    /\bconst\b|\blet\b|\bvar\b/,                         // JS keywords
    /\b(if|else|for|while|return|import|export)\b\s*[\w({]/,
    /^\s*(\/\/|#|--|\*)\s/m,                             // comment lines
    /\b(npm|pip|cargo|go|make)\s+\w+/i
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
function classifyIntent(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { taskType: 'TEXT', confidence: 0.5, method: 'default' };
  }

  const normalized = prompt.trim().toLowerCase();

  // ── Tier 1: Hard keyword match (highest priority) ──────────────────────────
  const tier1Order = ['VIDEO_GENERATION', 'IMAGE_GENERATION', 'CODE', 'MATH'];
  for (const taskType of tier1Order) {
    const keywords = HARD_KEYWORDS[taskType];
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        return { taskType, confidence: 0.97, method: 'keyword' };
      }
    }
  }

  // ── Tier 2: Regex heuristic match ─────────────────────────────────────────
  const tier2Order = ['VIDEO_GENERATION', 'IMAGE_GENERATION', 'CODE', 'MATH'];
  for (const taskType of tier2Order) {
    const patterns = REGEX_PATTERNS[taskType];
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        return { taskType, confidence: 0.85, method: 'regex' };
      }
    }
  }

  // ── Tier 3: Weighted vocabulary scoring ───────────────────────────────────
  const words = normalized.split(/\W+/).filter(Boolean);
  const scores = {};

  for (const taskType of TASK_TYPES) {
    const vocab = SCORE_VOCAB[taskType] || [];
    scores[taskType] = words.reduce((acc, word) => {
      return acc + (vocab.includes(word) ? 1 : 0);
    }, 0);
  }

  // Normalize by vocab size to avoid bias
  const normalized_scores = {};
  for (const taskType of TASK_TYPES) {
    const vocab = SCORE_VOCAB[taskType] || [];
    normalized_scores[taskType] = scores[taskType] / Math.max(vocab.length, 1);
  }

  const topType = Object.entries(normalized_scores).sort(([, a], [, b]) => b - a)[0];
  const topScore = topType[1];

  if (topScore > 0) {
    const confidence = Math.min(0.5 + topScore * 5, 0.82);
    return { taskType: topType[0], confidence, method: 'scoring' };
  }

  // ── Default: TEXT for general language tasks ───────────────────────────────
  return { taskType: 'TEXT', confidence: 0.6, method: 'default' };
}

/**
 * Optimize a prompt for a given task type by injecting task-specific system priming.
 *
 * @param {string} prompt - The original prompt
 * @param {TaskType} taskType - The classified task type
 * @returns {string} - The optimized/augmented prompt
 */
function optimizePrompt(prompt, taskType) {
  const templates = {
    TEXT: (p) => p.trim(),
    MATH: (p) =>
      `Solve the following step-by-step, showing all intermediate workings and final answer:\n\n${p.trim()}`,
    CODE: (p) =>
      `Write clean, well-commented, production-ready code for the following requirement. Include edge case handling and example usage:\n\n${p.trim()}`,
    IMAGE_GENERATION: (p) =>
      `${p.trim()}, highly detailed, professional quality, sharp focus, vibrant lighting`,
    VIDEO_GENERATION: (p) =>
      `${p.trim()}, cinematic quality, smooth motion, high framerate, professional color grading`
  };

  return (templates[taskType] || templates['TEXT'])(prompt);
}

module.exports = { classifyIntent, optimizePrompt, TASK_TYPES };
