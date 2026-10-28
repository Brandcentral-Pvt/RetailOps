const fs = require('fs');

const s = fs.readFileSync('src/modules/tasks/services/tasksApi.js', 'utf8');
const lines = s.split('\n');

// Method definition pattern: "  methodName: async (...) =>"
const methodRegex = /^\s{2}(\w+):\s*async\s*\(/;

// Collect all method definition line indices
const methodLines = []; // { line: number, name: string }
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(methodRegex);
  if (m) {
    methodLines.push({ line: i, name: m[1] });
  }
}

// Find the LAST occurrence index in methodLines for each method name
const lastIndex = new Map();
for (let i = 0; i < methodLines.length; i++) {
  lastIndex.set(methodLines[i].name, i);
}

// Build set of line numbers to KEEP
const keepLines = new Set();

// Keep all non-method lines
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].match(methodRegex)) {
    keepLines.add(i);
  }
}

// Keep only the LAST definition of each method (full multi-line block)
for (let i = 0; i < methodLines.length; i++) {
  if (i !== lastIndex.get(methodLines[i].name)) continue; // skip non-last definitions

  const startLine = methodLines[i].line;
  // Find the closing brace of this method definition
  let depth = 0;
  let endLine = startLine;
  for (let j = startLine; j < lines.length; j++) {
    const line = lines[j];
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          endLine = j;
          break;
        }
      }
    }
    if (depth === 0) break;
  }

  // Keep all lines from startLine to endLine (inclusive)
  for (let j = startLine; j <= endLine; j++) {
    keepLines.add(j);
  }
}

// Build the deduplicated file
const dedupedLines = [];
for (let i = 0; i < lines.length; i++) {
  if (keepLines.has(i)) {
    dedupedLines.push(lines[i]);
  }
}

const deduped = dedupedLines.join('\n');
fs.writeFileSync('src/modules/tasks/services/tasksApi.js', deduped + '\n');

console.log(`Original lines: ${lines.length}`);
console.log(`Deduplicated lines: ${dedupedLines.length}`);
console.log(`Removed: ${lines.length - dedupedLines.length} lines`);

// Verify
const remainingMethodNames = [];
for (const line of dedupedLines) {
  const m = line.match(methodRegex);
  if (m) remainingMethodNames.push(m[1]);
}
const uniqueNames = new Set(remainingMethodNames);
console.log(`Unique method names: ${uniqueNames.size}`);
console.log(`Total method definitions: ${remainingMethodNames.length}`);
if (remainingMethodNames.length === uniqueNames.size) {
  console.log('NO DUPLICATES - SUCCESS!');
} else {
  console.log('DUPLICATES STILL EXIST');
  const counts = {};
  remainingMethodNames.forEach(name => counts[name] = (counts[name] || 0) + 1);
  const dupes = Object.entries(counts).filter(([k, v]) => v > 1);
  console.log('Duplicates:', JSON.stringify(duplicates, null, 2));
}
