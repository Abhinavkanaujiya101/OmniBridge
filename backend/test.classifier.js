const { classifyIntent, optimizePrompt } = require('./src/services/intent.classifier');
const { resolveRoute } = require('./src/services/routing.matrix');

const testCases = [
  'Tell me about the history of Rome',
  'Write a Python function to sort a list of dictionaries by a key',
  'Generate a comprehensive report on artificial intelligence trends in 2026',
  'Generate a photorealistic image of a futuristic city at dusk',
  'Create a cinematic video of waves crashing on a beach at sunset',
  'Write a document outlining enterprise software architecture',
  'Debug this JavaScript code: function foo() { return bar }',
  'Summarize this article about climate change',
  'write code to implement a binary search tree',
  'create a word file about renewable energy adoption',
];

console.log('\n=== OmniBridge Intent Classifier Smoke Test ===\n');
testCases.forEach((prompt, i) => {
  const cls = classifyIntent(prompt);
  const route = resolveRoute(cls.taskType);
  const primary = route.primary;
  const target = primary ? primary.provider + '/' + primary.model : 'NO_ROUTE (unconfigured)';
  console.log(
    '[' + (i + 1) + '] ' +
    cls.taskType.padEnd(22) +
    ' conf=' + cls.confidence.toFixed(2) +
    ' method=' + cls.method.padEnd(8) +
    ' -> ' + target
  );
  console.log('     prompt: ' + prompt.slice(0, 70));
  console.log('');
});

console.log('=== Routing Matrix Task Types ===');
['TEXT','DOCUMENT_GENERATION','CODE','IMAGE_GENERATION','VIDEO_GENERATION'].forEach(type => {
  const route = resolveRoute(type);
  const chain = [route.primary, ...route.fallbackChain].filter(Boolean);
  console.log('  ' + type + ':');
  chain.forEach((r, idx) => {
    console.log('    [' + idx + '] ' + r.provider + '/' + r.model + ' (' + r.costTier + ', ~' + r.estimatedLatencyMs + 'ms)');
  });
});
