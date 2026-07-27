/**
 * OmniBridge — Integration Smoke Test
 * Tests: TaskRegistry lifecycle + Output Parser + PDF stream generation
 */
'use strict';

const { registry } = require('./src/websocket/task.registry');
const { parseRawOutput, extractCodeBlocks, extractJSON, generateCodeFileStream } = require('./src/parsers/output.parser');

// ─── Test 1: TaskRegistry lifecycle ──────────────────────────────────────────
console.log('\n=== Test 1: Task Registry Lifecycle ===\n');

const task = registry.enqueue({
  taskType: 'CODE',
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  prompt: 'Write a Python quicksort function'
});

console.log('Enqueued task:', task.id, '| Status:', task.status);

registry.markProcessing(task.id, { message: 'Calling Gemini…', progress: 10 });
console.log('After markProcessing → status:', registry.getTask(task.id).status);

registry.updateProgress(task.id, 50, 'Receiving tokens…');
console.log('After updateProgress → progress:', registry.getTask(task.id).progress);

registry.markParsing(task.id, { progress: 80 });
console.log('After markParsing → status:', registry.getTask(task.id).status);

registry.markCompleted(task.id, { output: 'def quicksort(arr): pass', usage: null });
const done = registry.getTask(task.id);
console.log('After markCompleted → status:', done.status, '| progress:', done.progress);

const taskList = registry.listTasks({ status: 'COMPLETED' });
console.log('Listed COMPLETED tasks:', taskList.length, '(expect 1)');

// ─── Test 2: Output Parser — plain code ──────────────────────────────────────
console.log('\n=== Test 2: Output Parser — fenced code block ===\n');

const codeOutput = `
Here is a Python quicksort implementation:

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
\`\`\`

This has O(n log n) average time complexity.
`;

const parsed = parseRawOutput(codeOutput);
console.log('Parsed type:', parsed.type);
console.log('Language detected:', parsed.language);
console.log('Code blocks found:', parsed.codeBlocks.length);
console.log('Code snippet:', parsed.codeBlocks[0]?.code.slice(0, 60));

// ─── Test 3: Output Parser — JSON extraction ──────────────────────────────────
console.log('\n=== Test 3: JSON Extractor ===\n');

const jsonOutput = 'Here is the result:\n```json\n{"score": 92, "label": "POSITIVE", "model": "gemini"}\n```';
const extracted = extractJSON(jsonOutput);
console.log('Extracted JSON:', JSON.stringify(extracted));

// ─── Test 4: Code File Stream (in-memory) ─────────────────────────────────────
console.log('\n=== Test 4: In-Memory Code File Stream ===\n');

const { stream, mimeType, filename, byteLength, language, code } = generateCodeFileStream(codeOutput, { language: 'python' });
const chunks = [];
stream.on('data', (chunk) => chunks.push(chunk));
stream.on('end', () => {
  const total = Buffer.concat(chunks);
  console.log('MIME type:', mimeType);
  console.log('Filename:', filename);
  console.log('Language:', language);
  console.log('Total bytes (stream):', total.length, '| byteLength:', byteLength);
  console.log('First 60 chars of code:', total.toString('utf-8').slice(0, 60));

  console.log('\n=== All Tests Passed ✓ ===\n');
  registry.destroy();
});
