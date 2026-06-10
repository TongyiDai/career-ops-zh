import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);

const configArg = valueArg('--config') || 'config/tracker-backends.example.json';
const backendArg = valueArg('--backend');
const outputArg = valueArg('--output') || `output/tracker-lark-base-records-${today}.json`;
const printCli = args.includes('--print-cli');
const strict = args.includes('--strict');
const executeLark = args.includes('--execute-lark');

function valueArg(name) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readJson(rel) {
  const full = path.join(root, rel);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function readText(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function cleanCell(cell) {
  return (cell || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\\|/g, '｜')
    .trim();
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells = [];
  let current = '';
  let escaped = false;
  for (let i = 1; i < trimmed.length - 1; i += 1) {
    const ch = trimmed[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '|') {
      cells.push(cleanCell(current));
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(cleanCell(current));
  return cells;
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function parseMarkdownTable(content) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i += 1) {
    const headers = splitMarkdownRow(lines[i]);
    const separator = splitMarkdownRow(lines[i + 1]);
    if (!headers.length || !isSeparator(separator)) continue;

    const rows = [];
    for (let j = i + 2; j < lines.length; j += 1) {
      const cells = splitMarkdownRow(lines[j]);
      if (!cells.length) break;
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] || '';
      });
      if (Object.values(row).some(Boolean)) rows.push(row);
    }
    return { headers, rows };
  }
  return { headers: [], rows: [] };
}

function mapRecord(row, mapping) {
  const fields = {};
  for (const [sourceField, targetField] of Object.entries(mapping || {})) {
    fields[targetField] = row[sourceField] || '';
  }
  return fields;
}

function mapKeyConditions(row, table) {
  return (table.key_fields || []).map((sourceField) => ({
    source_field: sourceField,
    target_field: table.field_mapping?.[sourceField] || sourceField,
    value: row[sourceField] || ''
  }));
}

function buildExternalKey(row, keyFields) {
  return (keyFields || [])
    .map((field) => row[field] || '')
    .join(' | ')
    .trim();
}

function maskToken(token) {
  if (!token || token.includes('xxx')) return token || '';
  return `${token.slice(0, 6)}***${token.slice(-4)}`;
}

function maskSensitive(text, packageData) {
  let out = String(text);
  const token = packageData?.lark_base?.app_token;
  if (token) out = out.split(token).join(maskToken(token));
  for (const table of packageData?.tables || []) {
    if (table.table_id) out = out.split(table.table_id).join(maskToken(table.table_id));
  }
  return out;
}

function validateLarkBaseConfig(config, { active = false } = {}) {
  const errors = [];
  const backend = config.backends?.['lark-base'];
  if (!backend) errors.push('缺少 backends.lark-base 配置');
  if (active && (!backend?.app_token || backend.app_token.includes('xxx'))) {
    errors.push('错误: lark-base app_token 为空或仍是占位符');
  }
  for (const [name, table] of Object.entries(backend?.tables || {})) {
    if (!table.source) errors.push(`${name}: 缺少 source`);
    if (active && (!table.table_id || table.table_id.includes('xxx'))) {
      errors.push(`错误: ${name} table_id 为空或仍是占位符`);
    }
    if (table.source && !exists(table.source)) errors.push(`${name}: source 不存在：${table.source}`);
  }
  return errors;
}

function renderCliHints(packageData) {
  const lines = [];
  lines.push('# 可选：使用 lark-cli / 飞书多维表格能力导入这些 records');
  lines.push('# 下面是安全的操作计划，不直接包含用户隐私 token。实际命令请按你的 lark-cli 版本和权限调整。');
  lines.push('');
  lines.push(`AppToken: ${maskToken(packageData.lark_base.app_token)}`);
  for (const table of packageData.tables) {
    lines.push('');
    lines.push(`## ${table.name}`);
    lines.push(`Source: ${table.source}`);
    lines.push(`TableID: ${maskToken(table.table_id)}`);
    lines.push(`Records: ${table.records.length}`);
    lines.push('# 建议策略：先按 external_key 查询/去重，再 upsert fields；不要盲目重复插入。');
  }
  return lines.join('\n');
}

function shellEscape(value) {
  const s = String(value);
  if (/^[A-Za-z0-9_\-.+=/:@,]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function keyFilterJson(key_conditions) {
  return JSON.stringify({
    logic: 'and',
    conditions: key_conditions.map((item) => [item.target_field, '==', item.value])
  });
}

function buildLarkUpsertCommands(packageData) {
  const commands = [];
  for (const table of packageData.tables) {
    for (const record of table.records) {
      const filterJson = record.key_conditions?.every((item) => item.value) ? keyFilterJson(record.key_conditions) : '';
      if (filterJson) {
        commands.push(`# lookup ${table.name}: ${record.external_key}`);
        commands.push([
          'lark-cli', 'base', '+record-search',
          '--base-token', packageData.lark_base.app_token,
          '--table-id', table.table_id,
          '--filter-json', filterJson,
          '--limit', '2',
          '--format', 'json'
        ].map(shellEscape).join(' '));
      }
      commands.push(`# create or update ${table.name}: ${record.external_key}（如 lookup 命中，真实执行会自动追加 --record-id）`);
      commands.push([
        'lark-cli', 'base', '+record-upsert',
        '--base-token', packageData.lark_base.app_token,
        '--table-id', table.table_id,
        '--json', JSON.stringify(record.fields)
      ].map(shellEscape).join(' '));
    }
  }
  return commands;
}

function buildLarkUpsertArgs(packageData) {
  const ops = [];
  for (const table of packageData.tables) {
    for (const record of table.records) {
      ops.push({
        table: table.name,
        table_id: table.table_id,
        external_key: record.external_key,
        key_conditions: record.key_conditions || [],
        fields: record.fields,
        base_token: packageData.lark_base.app_token,
        upsert_args: (recordId) => [
          'base', '+record-upsert',
          '--base-token', packageData.lark_base.app_token,
          '--table-id', table.table_id,
          ...(recordId ? ['--record-id', recordId] : []),
          '--json', JSON.stringify(record.fields)
        ],
        args: [
          'base', '+record-upsert',
          '--base-token', packageData.lark_base.app_token,
          '--table-id', table.table_id,
          '--json', JSON.stringify(record.fields)
        ]
      });
    }
  }
  return ops;
}

function parseJsonLoose(stdout) {
  if (!stdout?.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    const m = stdout.match(/[\[{][\s\S]*[\]}]\s*$/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`无法解析 lark-cli JSON 输出：${stdout.slice(0, 500)}`);
  }
}

function collectRecordIds(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (typeof value.record_id === 'string') out.push(value.record_id);
  if (typeof value.id === 'string' && value.id.startsWith('rec')) out.push(value.id);
  if (Array.isArray(value)) {
    value.forEach((item) => collectRecordIds(item, out));
  } else {
    Object.values(value).forEach((item) => collectRecordIds(item, out));
  }
  return [...new Set(out)];
}

function findExistingRecordId(op) {
  if (!op.key_conditions.every((item) => item.value)) {
    throw new Error(`${op.table} ${op.external_key}: key_fields 不完整，拒绝写入以避免重复记录`);
  }
  const stdout = execFileSync('lark-cli', [
    'base', '+record-search',
    '--base-token', op.base_token,
    '--table-id', op.table_id,
    '--filter-json', keyFilterJson(op.key_conditions),
    '--limit', '2',
    '--format', 'json'
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const ids = collectRecordIds(parseJsonLoose(stdout));
  if (ids.length > 1) {
    throw new Error(`${op.table} ${op.external_key}: 飞书 Base 中命中多条记录，拒绝自动更新，请先去重`);
  }
  return ids[0] || '';
}

function runLarkUpserts(packageData) {
  const ops = buildLarkUpsertArgs(packageData);
  const results = [];
  for (const op of ops) {
    const existingRecordId = findExistingRecordId(op);
    const stdout = execFileSync('lark-cli', op.upsert_args(existingRecordId), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000
    });
    results.push({
      table: op.table,
      external_key: op.external_key,
      action: existingRecordId ? 'update' : 'create',
      record_id: existingRecordId || undefined,
      ok: true,
      stdout: stdout.trim().slice(0, 500)
    });
  }
  return results;
}

const config = readJson(configArg);
const backendName = backendArg || config.default_backend || 'local-markdown';
const larkBackend = config.backends?.['lark-base'];
const shouldValidateLark = backendName === 'lark-base' || printCli || strict || executeLark || Boolean(larkBackend?.enabled);
const validationErrors = shouldValidateLark ? validateLarkBaseConfig(config, { active: true }) : [];

if ((strict || executeLark) && validationErrors.some((error) => error.startsWith('错误') || !error.startsWith('提示'))) {
  console.error(JSON.stringify({ ok: false, validationErrors }, null, 2));
  process.exit(1);
}

const tables = Object.entries(larkBackend?.tables || {}).map(([name, table]) => {
  const parsed = table.source && exists(table.source)
    ? parseMarkdownTable(readText(table.source))
    : { headers: [], rows: [] };
  return {
    name,
    source: table.source,
    table_id: table.table_id,
    key_fields: table.key_fields || [],
    source_headers: parsed.headers,
    records: parsed.rows.map((row) => ({
      external_key: buildExternalKey(row, table.key_fields),
      key_conditions: mapKeyConditions(row, table),
      fields: mapRecord(row, table.field_mapping)
    }))
  };
});

const packageData = {
  generated_at: new Date().toISOString(),
  backend: backendName,
  mode: larkBackend?.enabled ? 'lark-base-configured' : 'preview-export-only',
  warnings: validationErrors,
  lark_base: {
    enabled: Boolean(larkBackend?.enabled),
    app_token: larkBackend?.app_token || ''
  },
  tables
};

const outputData = {
  ...packageData,
  lark_base: {
    ...packageData.lark_base,
    app_token: maskToken(packageData.lark_base.app_token)
  },
  lark_cli_commands_preview: printCli ? buildLarkUpsertCommands(packageData).map((cmd) => maskSensitive(cmd, packageData)) : undefined
};

fs.mkdirSync(path.dirname(path.join(root, outputArg)), { recursive: true });
fs.writeFileSync(path.join(root, outputArg), JSON.stringify(outputData, null, 2), 'utf8');

console.log(JSON.stringify({
  ok: true,
  backend: backendName,
  output: outputArg,
  tables: tables.map((table) => ({ name: table.name, source: table.source, records: table.records.length })),
  warnings: validationErrors
}, null, 2));

if (printCli) {
  console.log('\n' + renderCliHints(packageData));
  const commands = buildLarkUpsertCommands(packageData);
  if (commands.length) {
    console.log('\n# record-upsert 命令预览（token 已脱敏）');
    for (const cmd of commands) {
      console.log(maskSensitive(cmd, packageData));
    }
  }
}

if (executeLark) {
  const results = runLarkUpserts(packageData);
  console.log(JSON.stringify({ ok: true, executed: results.length, results }, null, 2));
}
