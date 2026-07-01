// Parse pasted spreadsheet data or a CSV file into Customer List rows.
// Handles tab-separated paste (Excel/Sheets) and quoted CSV, detects a header
// row (mapping columns by name), and falls back to positional column order.

export type CustomerField =
  | 'state' | 'school' | 'conference' | 'rosterLink' | 'division'
  | 'firstDegreeConn' | 'firstDegreeNotes' | 'instagram' | 'email' | 'notes';

// Canonical column order — also the positional fallback when there's no header.
export const CUSTOMER_FIELDS: CustomerField[] = [
  'state', 'school', 'conference', 'rosterLink', 'division',
  'firstDegreeConn', 'firstDegreeNotes', 'instagram', 'email', 'notes',
];

export interface ParsedImport {
  records: Record<CustomerField, string>[];
  headerDetected: boolean;
  mapped: CustomerField[];
}

// Header aliases (normalized: lowercased, alphanumerics only).
const ALIASES: Record<CustomerField, string[]> = {
  state: ['state', 'st'],
  school: ['school', 'team', 'college', 'university', 'program', 'name'],
  conference: ['conference', 'conf'],
  rosterLink: ['rosterlink', '2026rosterlink', '2026roster', 'roster', 'rosterurl'],
  division: ['division', 'div'],
  firstDegreeConn: ['1stdegreeconn', 'firstdegreeconn', '1stdegreeconnection', '1stdegree', 'connection', 'conn'],
  firstDegreeNotes: ['1stdegreenotes', 'firstdegreenotes', 'connectionnotes', 'degreenotes', 'connnotes'],
  instagram: ['instagram', 'ig', 'insta'],
  email: ['email', 'emailaddress', 'mail'],
  notes: ['notes', 'note', 'comment', 'comments'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const NORM_TO_FIELD = new Map<string, CustomerField>();
for (const f of CUSTOMER_FIELDS) for (const a of ALIASES[f]) NORM_TO_FIELD.set(a, f);

/** Split text into a grid: tab-delimited if the first line has tabs, else CSV. */
function parseGrid(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!t.trim()) return [];
  const firstLine = t.slice(0, t.indexOf('\n') === -1 ? undefined : t.indexOf('\n'));
  if (firstLine.includes('\t')) {
    return t.split('\n').filter((l) => l.trim() !== '').map((l) => l.split('\t').map((c) => c.trim()));
  }
  return parseCsv(t);
}

/** Quote-aware CSV parser (handles "", embedded commas and newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row.map((s) => s.trim())); row = []; field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row.map((s) => s.trim()));
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** If ≥2 cells match known column names, treat the first row as a header. */
function detectHeader(cells: string[]): Map<number, CustomerField> | null {
  const map = new Map<number, CustomerField>();
  const used = new Set<CustomerField>();
  cells.forEach((c, i) => {
    const f = NORM_TO_FIELD.get(norm(c));
    if (f && !used.has(f)) { map.set(i, f); used.add(f); }
  });
  return map.size >= 2 ? map : null;
}

function positionalMap(width: number): Map<number, CustomerField> {
  const m = new Map<number, CustomerField>();
  for (let i = 0; i < Math.min(width, CUSTOMER_FIELDS.length); i++) m.set(i, CUSTOMER_FIELDS[i]);
  return m;
}

function emptyRecord(): Record<CustomerField, string> {
  return Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, ''])) as Record<CustomerField, string>;
}

export function parseImport(text: string): ParsedImport | null {
  const grid = parseGrid(text);
  if (!grid.length) return null;

  const headerMap = detectHeader(grid[0]);
  const headerDetected = headerMap != null;
  const map = headerMap ?? positionalMap(grid[0].length);
  const dataRows = headerDetected ? grid.slice(1) : grid;

  const records = dataRows
    .map((cells) => {
      const rec = emptyRecord();
      for (const [i, f] of map) rec[f] = (cells[i] ?? '').trim();
      return rec;
    })
    .filter((rec) => CUSTOMER_FIELDS.some((f) => rec[f] !== ''));

  const mapped = CUSTOMER_FIELDS.filter((f) => [...map.values()].includes(f));
  return { records, headerDetected, mapped };
}
