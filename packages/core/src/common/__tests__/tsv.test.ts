import {parseTsv, stringifyTsv} from '../tsv';

interface TestCase {
  readonly label: string;
  readonly tsv: string;
  readonly forStringify?: string;
  readonly data: string[][];
}

const tsvCases: TestCase[] = [
  {label: 'empty string', tsv: '', data: []},
  {label: 'empty cells', tsv: '\t\t', data: [['', '', '']]},
  {
    label: 'empty rows',
    tsv: '\t\t\n\t\t',
    data: [
      ['', '', ''],
      ['', '', ''],
    ],
  },
  {
    label: 'surrogate pair and ligature',
    tsv: '👨🏻‍🦱\t👨🏻‍🦱\n𦥯\t𦥯',
    data: [
      ['👨🏻‍🦱', '👨🏻‍🦱'],
      ['𦥯', '𦥯'],
    ],
  },
  {label: 'LF char', tsv: '\n', forStringify: '', data: [['']]},
  {
    label: 'LF char',
    tsv: ['a\tb\t"c"', 'd\teee\t"fffff"'].join('\n'),
    forStringify: ['a\tb\tc', 'd\teee\tfffff'].join('\n'),
    data: [
      ['a', 'b', 'c'],
      ['d', 'eee', 'fffff'],
    ],
  },
  {
    label: 'cell contains double quotation',
    tsv: 'a\t"""b""c"\t"d"""',
    data: [['a', '"b"c', 'd"']],
  },
  {
    label: 'cell contains double quotation',
    tsv: 'a\t"\nb\nc"\t"d\n"',
    data: [['a', '\nb\nc', 'd\n']],
  },
  {
    label: 'cell contains double tab',
    tsv: 'a\t"\tb\tc"\t"d\t"',
    data: [['a', '\tb\tc', 'd\t']],
  },
];

describe('Unit tests for parseTsv', () => {
  it.each(tsvCases)('Parse $label', (testCase) => {
    expect(parseTsv(testCase.tsv)).toEqual(testCase.data);
  });
});

describe('Unit tests for stringifyTsv', () => {
  it.each(tsvCases)('Stringify $label', (testCase) => {
    expect(stringifyTsv(testCase.data)).toEqual(testCase.forStringify ?? testCase.tsv);
  });
});
