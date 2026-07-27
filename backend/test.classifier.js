const { classifyIntent, optimizePrompt } = require('./src/services/intent.classifier');
const { resolveRoute } = require('./src/services/routing.matrix');

const testCases = [
  'Tell me about the history of Rome',
  'Write a Python function to sort a list of dictionaries by a key',
  'Calculate the integral of x^2 from 0 to 5',
  'Generate a photorealistic image of a futuristic city at dusk',
  'Create a cinematic video of waves crashing on a beach at sunset',
  'What is 42 * 17?',
  'Debug this JavaScript code: function foo() { return bar }',
  'Summarize this article about climate change',
  'write code to implement a binary search tree',
  'generate an image of a dragon in anime style',
];

console.log('\n=== OmniBridge Intent Classifier Smoke Test ===\n');
testCases.forEach((prompt, i) => {
  const cls = classifyIntent(prompt);
  const route = resolveRoute(cls.taskType);
  const primary = route.primary;
  const target = primary ? primary.provider + '/' + primary.model : 'NO_ROUTE (unconfigured)';
  console.log(
    '[' + (i + 1) + '] ' +
    cls.taskType.padEnd(20) +
    ' conf=' + cls.confidence.toFixed(2) +
    ' method=' + cls.method.padEnd(8) +
    ' -> ' + target
  );
  console.log('     prompt: ' + prompt.slice(0, 70));
  console.log('');
});

console.log('=== Routing Matrix Task Types ===');
['TEXT','MATH','CODE','IMAGE_GENERATION','VIDEO_GENERATION'].forEach(type => {
  const route = resolveRoute(type);
  const chain = [route.primary, ...route.fallbackChain].filter(Boolean);
  console.log('  ' + type + ':');
  chain.forEach((r, idx) => {
    console.log('    [' + idx + '] ' + r.provider + '/' + r.model + ' (' + r.costTier + ', ~' + r.estimatedLatencyMs + 'ms)');
  });
});
