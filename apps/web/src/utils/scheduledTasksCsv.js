// CSV helper for Scheduled Tasks import/export (RFC4180-ish).

const HEADERS = [
  'name',
  'status',
  'squadId',
  'conversationId',
  'prompt',
  'firstRunAt',
  'recurrenceType',
  'recurrenceEvery',
];

const csvCell = (value) => {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
};

export const scheduledTasksToCsv = (tasks = []) => {
  const lines = [];
  lines.push(HEADERS.map(csvCell).join(','));

  for (const t of tasks) {
    const recurrenceType = t?.recurrence?.type ?? t?.recurrenceType ?? '';
    const recurrenceEvery = t?.recurrence?.every ?? t?.recurrenceEvery ?? '';

    const row = [
      t?.name ?? '',
      t?.status ?? '',
      t?.squadId ?? '',
      t?.conversationId ?? '',
      t?.prompt ?? '',
      t?.firstRunAt ?? t?.nextRunAt ?? '',
      recurrenceType,
      recurrenceEvery,
    ];

    lines.push(row.map(csvCell).join(','));
  }

  return lines.join('\r\n');
};

// Parser supporting quoted fields, commas, CRLF/LF, and newlines in quoted fields.
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    if (c === '\r') continue;

    field += c;
  }

  row.push(field);
  // avoid adding a final empty row if file ends with newline
  if (!(row.length === 1 && row[0] === '')) rows.push(row);

  return rows;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeIso = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
};

export const parseScheduledTasksCsv = (csvText) => {
  const text = (csvText || '').replace(/^\uFEFF/, ''); // strip BOM
  const rows = parseCsv(text).filter((r) => r.some((c) => String(c || '').trim() !== ''));

  if (!rows.length) return [];

  const headerRow = rows[0].map((h) => String(h || '').trim());
  const index = Object.fromEntries(headerRow.map((h, i) => [h, i]));

  if (!('name' in index) || !('prompt' in index)) {
    throw new Error(`Invalid CSV headers. Expected: ${HEADERS.join(', ')}`);
  }

  const tasks = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (key) => {
      const i = index[key];
      return i == null ? '' : (row[i] ?? '');
    };

    const name = String(get('name') || '').trim();
    const prompt = String(get('prompt') || '').trim();
    if (!name && !prompt) continue;

    const squadId = String(get('squadId') || '').trim();
    const conversationId = String(get('conversationId') || '').trim();

    const firstRunAtRaw = String(get('firstRunAt') || '').trim();
    const firstRunAt = normalizeIso(firstRunAtRaw);

    const recurrenceType = String(get('recurrenceType') || '').trim();
    const recurrenceEvery = toInt(String(get('recurrenceEvery') || '').trim());

    tasks.push({
      name,
      prompt,
      squadId,
      conversationId,
      firstRunAt,
      recurrence: recurrenceType
        ? { type: recurrenceType, ...(recurrenceEvery ? { every: recurrenceEvery } : {}) }
        : undefined,
      status: String(get('status') || '').trim(),
    });
  }

  return tasks;
};