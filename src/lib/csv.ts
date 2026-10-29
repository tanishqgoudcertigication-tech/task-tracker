export interface CSVTaskRow {
  rowNum: number;
  date: string;
  title: string;
  assigned_email: string;
  assigned_to: string | null;
  error: string | null;
}

export interface CSVParseResult {
  rows: CSVTaskRow[];
  hasErrors: boolean;
  totalValid: number;
  errorSummary: string | null;
}

/**
 * Parses a single CSV line accounting for quoted fields with commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Validates a YYYY-MM-DD date string.
 */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Parses and validates CSV content containing tasks.
 */
export function parseAndValidateCSV(
  text: string,
  teammatesByEmail: Record<string, { id: string; name: string | null; email: string | null }>
): CSVParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      hasErrors: true,
      totalValid: 0,
      errorSummary: 'The uploaded file is empty.',
    };
  }

  const rawHeaders = parseCSVLine(lines[0]);
  const normalizedHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '')
  );

  const dateIdx = normalizedHeaders.findIndex((h) => h === 'date');
  const titleIdx = normalizedHeaders.findIndex((h) => h === 'title');
  const emailIdx = normalizedHeaders.findIndex((h) =>
    h === 'assigned_email' || h === 'assignedemail' || h === 'email'
  );

  if (dateIdx === -1 || titleIdx === -1) {
    return {
      rows: [],
      hasErrors: true,
      totalValid: 0,
      errorSummary:
        "CSV header must contain 'date' and 'title' columns (optional 'assigned_email').",
    };
  }

  const rows: CSVTaskRow[] = [];
  let hasErrors = false;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const rawDate = (values[dateIdx] || '').trim();
    const rawTitle = (values[titleIdx] || '').trim();
    const rawEmail = emailIdx !== -1 ? (values[emailIdx] || '').trim() : '';

    let error: string | null = null;
    let assigned_to: string | null = null;

    if (!isValidDate(rawDate)) {
      error = `Invalid date '${rawDate}' (must be YYYY-MM-DD)`;
    } else if (!rawTitle) {
      error = 'Title is missing or empty';
    } else if (rawEmail) {
      const match = teammatesByEmail[rawEmail.toLowerCase()];
      if (match) {
        assigned_to = match.id;
      } else {
        error = `No teammate found with email '${rawEmail}'`;
      }
    }

    if (error) {
      hasErrors = true;
    }

    rows.push({
      rowNum: i,
      date: rawDate,
      title: rawTitle,
      assigned_email: rawEmail,
      assigned_to,
      error,
    });
  }

  const totalValid = rows.filter((r) => !r.error).length;

  return {
    rows,
    hasErrors,
    totalValid,
    errorSummary: null,
  };
}
