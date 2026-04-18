export type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedCsvFile = {
  headers: string[];
  rows: ParsedCsvRow[];
};

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const source = normalizeLineEndings(text);

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export function parseCsvFile(text: string): ParsedCsvFile {
  const matrix = parseCsvMatrix(text);
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0].map((header) => header.trim());
  const rows: ParsedCsvRow[] = matrix.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      values[header] = (cells[cellIndex] ?? '').trim();
    });
    return {
      rowNumber: index + 2,
      values,
    };
  });

  return { headers, rows };
}
