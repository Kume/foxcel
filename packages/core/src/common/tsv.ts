type AnySpecialChar = '"' | '\n' | '\r\n' | '\t';
const specialChars = ['"', '\n', '\r\n', '\t'] as const;

function findSpecialCharIndex(text: string, offset: number): [AnySpecialChar, number] | undefined {
  let neerestIndex: number | undefined;
  let neerestChar: AnySpecialChar | undefined;
  for (const char of specialChars) {
    const index = text.indexOf(char, offset);
    if (index >= 0 && (neerestIndex === undefined || index < neerestIndex)) {
      neerestIndex = index;
      neerestChar = char;
    }
  }
  return neerestChar ? [neerestChar, neerestIndex!] : undefined;
}

export function parseTsv(tsv: string): string[][] {
  if (tsv.length === 0) {
    return [];
  }
  let cursor = 0;
  let parsedRow: string[] = [];
  const parsedRows: string[][] = [];
  let findResult: [AnySpecialChar, number] | undefined;
  let readingText = '';
  while ((findResult = findSpecialCharIndex(tsv, cursor))) {
    readingText += tsv.substring(cursor, findResult[1]);
    cursor = findResult[1];
    switch (findResult[0]) {
      case '"': {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const nextIndex = tsv.indexOf('"', cursor + 1);
          if (nextIndex < 0) {
            // No closing quotation.
            readingText += tsv.substring(cursor);
            parsedRow.push(readingText);
            cursor = tsv.length;
            break;
          }
          if (tsv[nextIndex + 1] === '"') {
            readingText += tsv.substring(cursor + 1, nextIndex + 1).replace(/\r\n/g, '\n');
            cursor = nextIndex + 1;
          } else {
            readingText += tsv.substring(cursor + 1, nextIndex).replace(/\r\n/g, '\n');
            cursor = nextIndex + 1;
            break;
          }
        }
        break;
      }
      case '\n':
        parsedRow.push(readingText);
        readingText = '';
        parsedRows.push(parsedRow);
        parsedRow = [];
        cursor += 1;
        break;
      case '\r\n':
        parsedRow.push(readingText);
        readingText = '';
        parsedRows.push(parsedRow);
        parsedRow = [];
        cursor += 2;
        break;
      case '\t':
        parsedRow.push(readingText);
        readingText = '';
        cursor += 1;
        break;
    }
  }
  const remainText = readingText + tsv.substring(cursor);
  if (remainText.length > 0) {
    parsedRow.push(remainText);
  } else {
    const lastChar = tsv.substring(tsv.length - 1);
    if (lastChar === '\t' || lastChar === '\n') {
      parsedRow.push('');
    }
  }
  if (parsedRow.length > 0) {
    parsedRows.push(parsedRow);
  }
  return parsedRows;
}

export function stringifyTsv(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map((cell) =>
          cell.includes('\t') || cell.includes('\n') || cell.includes('"')
            ? `"${cell.replace(/"/g, '""').replace(/\r\n/g, '\n')}"`
            : cell,
        )
        .join('\t'),
    )
    .join('\n');
}
