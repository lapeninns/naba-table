export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  const needsQuoting =
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r");

  if (!needsQuoting) {
    return stringValue;
  }

  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

type CSVColumn<T> = {
  header: string;
  accessor: (row: T) => unknown;
};

export function generateCSV<T>(data: T[], columns: CSVColumn<T>[]): string {
  const headers = columns.map((col) => escapeCSVField(col.header));
  const headerRow = headers.join(",");

  const dataRows = data.map((row) => {
    const values = columns.map((col) => {
      const value = col.accessor(row);
      return escapeCSVField(value);
    });
    return values.join(",");
  });

  const csvContent = [headerRow, ...dataRows].join("\n");

  return csvContent;
}

export function downloadCSV(csv: string, filename: string): void {
  const BOM = "\uFEFF";
  const csvWithBOM = BOM + csv;

  const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
