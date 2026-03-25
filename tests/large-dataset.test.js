const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const repoRoot = path.resolve(__dirname, '..');
const workerPath = path.join(repoRoot, 'v6', 'utils', 'diff-worker.js');
const appPath = path.join(repoRoot, 'v6', 'index.html');

function createWorkerHarness() {
  const source = fs.readFileSync(workerPath, 'utf8');
  const outboundMessages = [];
  let messageHandler = null;

  const self = {
    addEventListener(type, handler) {
      if (type === 'message') {
        messageHandler = handler;
      }
    },
    postMessage(message) {
      outboundMessages.push(message);
    }
  };

  const context = vm.createContext({
    self,
    console,
    performance,
    setTimeout,
    clearTimeout
  });

  new vm.Script(source, { filename: workerPath }).runInContext(context);
  outboundMessages.length = 0;

  return {
    async invoke(action, payload) {
      assert.ok(messageHandler, 'Worker message handler was not registered');

      const id = `${Date.now()}-${Math.random()}`;
      messageHandler({ data: { id, action, payload } });

      const timeoutAt = Date.now() + 30000;
      while (Date.now() < timeoutAt) {
        const index = outboundMessages.findIndex((message) => message && message.id === id);
        if (index !== -1) {
          const [message] = outboundMessages.splice(index, 1);
          if (!message.ok) {
            throw new Error(message.error || 'Worker request failed');
          }
          return message.result;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      throw new Error(`Timed out waiting for worker action: ${action}`);
    }
  };
}

function loadBuildJSONString() {
  const html = fs.readFileSync(appPath, 'utf8');
  const start = html.indexOf('function buildJSONString(data, options = {}) {');
  const end = html.indexOf('\n\n      // Share URL functionality', start);

  if (start === -1 || end === -1) {
    throw new Error('Could not locate buildJSONString in v6/index.html');
  }

  const source = `${html.slice(start, end)}; buildJSONString;`;
  const context = vm.createContext({
    window: {
      sortJSONKeys(value) {
        return value;
      }
    },
    console
  });

  return new vm.Script(source, { filename: appPath }).runInContext(context);
}

function generateWideCSV({
  rows = 12,
  columns = 1800,
  headerPrefix = 'col',
  valuePrefix = 'value',
  includeTypedColumns = true
} = {}) {
  const headers = [];
  for (let column = 0; column < columns; column++) {
    headers.push(`${headerPrefix}_${String(column).padStart(4, '0')}`);
  }

  const lines = [headers.join(',')];
  for (let row = 0; row < rows; row++) {
    const values = [];
    for (let column = 0; column < columns; column++) {
      if (includeTypedColumns && column === 0) {
        values.push(String(row));
      } else if (includeTypedColumns && column === 1) {
        values.push(row % 2 === 0 ? 'true' : 'false');
      } else if (includeTypedColumns && column === 2) {
        values.push((row + 0.5).toFixed(1));
      } else if (includeTypedColumns && column === 3) {
        values.push(row % 2 === 0 ? '' : `text_${row}`);
      } else {
        values.push(`${valuePrefix}_${row}_${column}_payload`);
      }
    }
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

async function runCase(name, fn) {
  const startedAt = performance.now();
  await fn();
  const duration = Math.round(performance.now() - startedAt);
  console.log(`PASS ${name} (${duration}ms)`);
}

const cases = {
  'wide-stringify': async function () {
    const buildJSONString = loadBuildJSONString();
    const row = {};

    for (let index = 0; index < 501; index++) {
      row[`field_${index}`] = index;
    }

    const data = [row];
    const actual = buildJSONString(data, { autoSort: false });
    const expected = JSON.stringify(data, null, 2);

    assert.equal(actual, expected);
  },

  'wide-csv-conversion': async function () {
    const harness = createWorkerHarness();
    const csv = generateWideCSV({ rows: 12, columns: 1800 });

    assert.ok(csv.length > 200000, `Expected wide CSV test fixture to exceed 200KB, got ${csv.length}`);

    const jsonText = await harness.invoke('csvToJsonString', { text: csv });
    const parsed = JSON.parse(jsonText);

    assert.equal(parsed.length, 12);
    assert.equal(Object.keys(parsed[0]).length, 1800);
    assert.equal(parsed[0].col_0000, 0);
    assert.equal(parsed[1].col_0000, 1);
    assert.equal(parsed[0].col_0001, true);
    assert.equal(parsed[1].col_0001, false);
    assert.equal(parsed[0].col_0002, 0.5);
    assert.equal(parsed[0].col_0003, null);
    assert.equal(parsed[1].col_0003, 'text_1');
  },

  'identical-large-diff': async function () {
    const harness = createWorkerHarness();
    const csv = generateWideCSV({ rows: 8, columns: 900, valuePrefix: 'same' });
    const jsonText = await harness.invoke('csvToJsonString', { text: csv });

    assert.ok(jsonText.length > 50000, `Expected JSON payload to exceed 50KB, got ${jsonText.length}`);

    const diffResult = await harness.invoke('countDiffs', {
      leftText: jsonText,
      rightText: jsonText
    });

    assert.equal(diffResult.diffCount, 0);
    assert.ok(diffResult.duration >= 0);
  },

  'different-large-diff': async function () {
    const harness = createWorkerHarness();
    const leftCsv = generateWideCSV({ rows: 6, columns: 600, headerPrefix: 'col', valuePrefix: 'alpha' });
    const rightCsv = generateWideCSV({ rows: 6, columns: 600, headerPrefix: 'col', valuePrefix: 'omega' });

    const leftJson = await harness.invoke('csvToJsonString', { text: leftCsv });
    const rightJson = await harness.invoke('csvToJsonString', { text: rightCsv });

    assert.ok(leftJson.length + rightJson.length > 50000, 'Expected combined JSON payload to exceed 50KB');

    const diffResult = await harness.invoke('countDiffs', {
      leftText: leftJson,
      rightText: rightJson
    });

    assert.ok(diffResult.diffCount > 0, `Expected differences, got ${diffResult.diffCount}`);
    assert.ok(diffResult.duration >= 0);
  },

  'single-change-diff': async function () {
    const harness = createWorkerHarness();
    const left = JSON.stringify([{ id: 1, status: 'before', payload: 'x'.repeat(4096) }], null, 2);
    const right = JSON.stringify([{ id: 1, status: 'after', payload: 'x'.repeat(4096) }], null, 2);

    const diffResult = await harness.invoke('countDiffs', {
      leftText: left,
      rightText: right
    });

    assert.equal(diffResult.diffCount, 1);
  }
};

async function runCaseInChild(caseId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, '--case', caseId], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`Case timed out after ${timeoutMs}ms: ${caseId}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (stdout.trim()) process.stdout.write(stdout);
      if (stderr.trim()) process.stderr.write(stderr);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Case failed: ${caseId} (code=${code}, signal=${signal || 'none'})`));
    });
  });
}

async function main() {
  const selectedCase = process.argv[2] === '--case' ? process.argv[3] : null;

  if (selectedCase) {
    const caseFn = cases[selectedCase];
    if (!caseFn) {
      throw new Error(`Unknown case: ${selectedCase}`);
    }
    await caseFn();
    return;
  }

  await runCase('buildJSONString reduces indentation for wide object arrays', () => runCaseInChild('wide-stringify'));
  await runCase('worker converts very wide CSV datasets correctly', () => runCaseInChild('wide-csv-conversion'));
  await runCase('worker reports zero differences for identical large datasets', () => runCaseInChild('identical-large-diff'));
  await runCase('worker detects differences for substantially different large datasets', () => runCaseInChild('different-large-diff'));
  await runCase('worker diff count stays stable for a single targeted content change', () => runCaseInChild('single-change-diff', 10000));

  console.log('PASS large dataset regression suite');
}

main().catch((error) => {
  console.error('FAIL large dataset regression suite');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});