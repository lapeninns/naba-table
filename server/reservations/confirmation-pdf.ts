type PdfColor = readonly [number, number, number];

export type ReservationConfirmationPdfInput = {
  reference: string | null | undefined;
  guestName: string | null | undefined;
  startAt: string | null | undefined;
  bookingDate: string | null | undefined;
  startTime: string | null | undefined;
  partySize: number | null | undefined;
  venueName: string | null | undefined;
  venueAddress: string | null | undefined;
  timezone: string | null | undefined;
  status: string | null | undefined;
  notes: string | null | undefined;
  generatedAt?: Date;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const HEADER_HEIGHT = 82;
const LABEL_X = MARGIN_X;
const VALUE_X = 190;
const ROW_GAP = 12;
const VALUE_LINE_HEIGHT = 16;
const LABEL_LINE_HEIGHT = 14;
const MAX_VALUE_CHARS = 54;
const NOTES_MAX_LENGTH = 800;

const BRAND_PRIMARY: PdfColor = [0.86, 0.34, 0.16];
const TEXT_PRIMARY: PdfColor = [0.13, 0.15, 0.19];
const TEXT_MUTED: PdfColor = [0.42, 0.46, 0.53];
const WHITE: PdfColor = [1, 1, 1];

const KNOWN_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_allocation: 'Pending allocation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  checked_in: 'Checked in',
  completed: 'Completed',
  no_show: 'No show',
  PRIORITY_WAITLIST: 'Priority waitlist',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

type DisplayValues = {
  reference: string;
  guestName: string;
  dateLabel: string;
  timeLabel: string;
  partyLabel: string;
  venueName: string;
  venueAddress: string;
  statusLabel: string;
  notesLabel: string;
  generatedLabel: string;
};

function sanitizePdfText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string): string {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function hexColor([r, g, b]: PdfColor): string {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Confirmed';
  if (KNOWN_STATUS_LABELS[status]) return KNOWN_STATUS_LABELS[status];
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFallbackDate(bookingDate: string | null | undefined): string {
  if (!bookingDate) return 'TBC';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate);
  if (!match) return bookingDate;
  const [, yearRaw, monthRaw, dayRaw] = match;
  const monthIndex = Number.parseInt(monthRaw, 10) - 1;
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return bookingDate;
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(day)) return bookingDate;
  return `${day} ${MONTH_NAMES[monthIndex]} ${yearRaw}`;
}

function normalizeTime(startTime: string | null | undefined): string {
  if (!startTime) return 'TBC';
  const match = /^(\d{2}):(\d{2})/.exec(startTime.trim());
  if (!match) return startTime;
  return `${match[1]}:${match[2]}`;
}

function formatDateTime(values: {
  startAt: string | null | undefined;
  bookingDate: string | null | undefined;
  startTime: string | null | undefined;
  timezone: string;
}): { dateLabel: string; timeLabel: string } {
  const { startAt, bookingDate, startTime, timezone } = values;

  if (startAt) {
    const parsed = new Date(startAt);
    if (!Number.isNaN(parsed.getTime())) {
      try {
        const dateLabel = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(parsed);
        const timeLabel = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(parsed);
        return { dateLabel, timeLabel };
      } catch {
        return { dateLabel: formatFallbackDate(bookingDate), timeLabel: normalizeTime(startTime) };
      }
    }
  }

  return { dateLabel: formatFallbackDate(bookingDate), timeLabel: normalizeTime(startTime) };
}

function formatGeneratedLabel(generatedAt: Date): string {
  const parsed = Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
  const base = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
  return `${base} UTC`;
}

function buildDisplayValues(input: ReservationConfirmationPdfInput): DisplayValues {
  const timezone = input.timezone?.trim() || 'Europe/London';
  const { dateLabel, timeLabel } = formatDateTime({
    startAt: input.startAt,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    timezone,
  });
  const party = Math.max(1, Number.isFinite(input.partySize) ? Number(input.partySize) : 1);
  const notes = (input.notes ?? '').trim();

  return {
    reference: input.reference?.trim() || 'Pending',
    guestName: input.guestName?.trim() || 'Guest',
    dateLabel,
    timeLabel,
    partyLabel: `${party} ${party === 1 ? 'guest' : 'guests'}`,
    venueName: input.venueName?.trim() || 'Nab a Table Venue',
    venueAddress: input.venueAddress?.trim() || 'Address unavailable',
    statusLabel: formatStatusLabel(input.status),
    notesLabel: notes.length > 0 ? notes.slice(0, NOTES_MAX_LENGTH) : 'No special requests.',
    generatedLabel: formatGeneratedLabel(input.generatedAt ?? new Date()),
  };
}

function wrapText(value: string, maxChars: number): string[] {
  const normalized = sanitizePdfText(value);
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const words = normalized.split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    if (word.length > maxChars) {
      pushCurrent();
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > maxChars) {
      pushCurrent();
      current = word;
    } else {
      current = next;
    }
  }

  pushCurrent();
  return lines.length > 0 ? lines : [''];
}

function drawRectangle(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: PdfColor;
}): string {
  return `q ${hexColor(params.fill)} rg ${params.x} ${params.y} ${params.width} ${params.height} re f Q`;
}

function drawText(params: {
  x: number;
  y: number;
  text: string;
  size: number;
  font: 'F1' | 'F2';
  color: PdfColor;
}): string {
  return `BT /${params.font} ${params.size} Tf ${hexColor(params.color)} rg 1 0 0 1 ${params.x} ${params.y} Tm (${escapePdfText(params.text)}) Tj ET`;
}

function buildContentStream(values: DisplayValues): string {
  const commands: string[] = [];

  commands.push(
    drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - HEADER_HEIGHT,
      width: PAGE_WIDTH,
      height: HEADER_HEIGHT,
      fill: BRAND_PRIMARY,
    }),
  );
  commands.push(
    drawText({
      x: MARGIN_X,
      y: PAGE_HEIGHT - 48,
      text: 'Nab a Table',
      size: 22,
      font: 'F1',
      color: WHITE,
    }),
  );
  commands.push(
    drawText({
      x: MARGIN_X,
      y: PAGE_HEIGHT - 68,
      text: 'Reservation Confirmation',
      size: 12,
      font: 'F2',
      color: WHITE,
    }),
  );

  let y = PAGE_HEIGHT - HEADER_HEIGHT - 34;
  commands.push(
    drawText({
      x: MARGIN_X,
      y,
      text: `Reference ${values.reference}`,
      size: 18,
      font: 'F1',
      color: TEXT_PRIMARY,
    }),
  );

  y -= 32;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Guest', value: values.guestName },
    { label: 'Date', value: values.dateLabel },
    { label: 'Time', value: values.timeLabel },
    { label: 'Party Size', value: values.partyLabel },
    { label: 'Venue', value: values.venueName },
    { label: 'Address', value: values.venueAddress },
    { label: 'Status', value: values.statusLabel },
    { label: 'Notes', value: values.notesLabel },
  ];

  for (const row of rows) {
    const wrapped = wrapText(row.value, MAX_VALUE_CHARS);
    commands.push(
      drawText({
        x: LABEL_X,
        y,
        text: row.label,
        size: 10,
        font: 'F1',
        color: TEXT_MUTED,
      }),
    );

    for (let index = 0; index < wrapped.length; index += 1) {
      commands.push(
        drawText({
          x: VALUE_X,
          y: y - index * VALUE_LINE_HEIGHT,
          text: wrapped[index],
          size: 12,
          font: 'F2',
          color: TEXT_PRIMARY,
        }),
      );
    }

    y -= Math.max(LABEL_LINE_HEIGHT, wrapped.length * VALUE_LINE_HEIGHT) + ROW_GAP;
    if (y < 92) {
      break;
    }
  }

  commands.push(
    drawText({
      x: MARGIN_X,
      y: 56,
      text: `Generated ${values.generatedLabel}`,
      size: 10,
      font: 'F2',
      color: TEXT_MUTED,
    }),
  );
  commands.push(
    drawText({
      x: MARGIN_X,
      y: 40,
      text: 'Need help? Contact the venue directly for urgent updates.',
      size: 10,
      font: 'F2',
      color: TEXT_MUTED,
    }),
  );

  return commands.join('\n');
}

function buildPdfDocument(objects: string[]): Buffer {
  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    const objectBody = `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    offsets.push(Buffer.byteLength(header + body, 'utf8'));
    body += objectBody;
  }

  const xrefOffset = Buffer.byteLength(header + body, 'utf8');
  const xrefRows = offsets
    .map((offset, index) =>
      index === 0
        ? '0000000000 65535 f '
        : `${offset.toString().padStart(10, '0')} 00000 n `,
    )
    .join('\n');

  const xref = `xref\n0 ${objects.length + 1}\n${xrefRows}\n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, 'utf8');
}

export function buildReservationConfirmationPdfBuffer(
  input: ReservationConfirmationPdfInput,
): Buffer {
  const display = buildDisplayValues(input);
  const content = buildContentStream(display);
  const contentLength = Buffer.byteLength(content, 'utf8');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
  ];

  return buildPdfDocument(objects);
}
