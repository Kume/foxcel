const separators = ['-', '/', '_', ' '];

export function isAlphaNum(value: string): boolean {
  return /^[0-9a-zA-Z]+$/.test(value);
}

export function isAlphaNumUnderscore(value: string): boolean {
  return /^[0-9a-zA-Z_]+$/.test(value);
}
export function isAlphaNumHyphen(value: string): boolean {
  return /^[0-9a-zA-Z-]+$/.test(value);
}

export function isCamelCase(value: string): boolean {
  if (/^\p{Lu}/u.test(value)) {
    return false;
  }
  if (separators.some((separator) => value.includes(separator))) {
    return false;
  }
  return true;
}

export function isPascalCase(value: string): boolean {
  if (/^\p{Ll}/u.test(value)) {
    return false;
  }
  if (separators.some((separator) => value.includes(separator))) {
    return false;
  }
  return true;
}

const separatorsWithoutHyphen = separators.filter((i) => i !== '-');

export function isKebabCase(value: string): boolean {
  if (/\p{Lu}/u.test(value)) {
    return false;
  }
  if (separatorsWithoutHyphen.some((separator) => value.includes(separator))) {
    return false;
  }
  return true;
}

const separatorsWithoutUnderscore = separators.filter((i) => i !== '_');

export function isSnakeCase(value: string): boolean {
  if (/\p{Lu}/u.test(value)) {
    return false;
  }
  if (separatorsWithoutUnderscore.some((separator) => value.includes(separator))) {
    return false;
  }
  return true;
}

export function isUpperSnakeCase(value: string): boolean {
  if (/\p{Ll}/u.test(value)) {
    return false;
  }
  if (separatorsWithoutUnderscore.some((separator) => value.includes(separator))) {
    return false;
  }
  return true;
}

/**
 * 多くのプログラミング言語で識別子として使えるであろう文字列かどうかを返します
 * - アルファベット、またはアンダースコアから始まる
 * - 数値、アルファベット、アンダースコア以外を含まない
 */
export function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(value);
}
