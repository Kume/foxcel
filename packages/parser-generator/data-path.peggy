Expression
  = AbsolutePath / ContextPath / RelativePath

AbsolutePath
  = "/" path: (ForwardPath / KeyWord) {
    return {t: 'abs', ...path}
  }

ContextPath
  = key:Word ":" reverse:(ReverseWord "/")* path:(ForwardPath / KeyWord) {
  	return {t: 'ctx', r: reverse.length, key, ...path}
  }

RelativePath
  = reverse:(ReverseWord "/")* path:(ForwardPath / KeyWord) {
  	return {t: 'rel', r: reverse.length, ...path}
  }



ForwardPath
  = path:JoinedPath pointsKey:("/" KeyWord)? {
    return {...path, p: !!pointsKey || undefined};
  }

JoinedPath
  = first: GeneralPathComponent components: ("/" GeneralPathComponent)* {
    return {c: [first].concat(components.map(([_, w]) => w))}
  }

GeneralPathComponent = WildWord / Word / PathVariable

PathVariable
  = "[" variable: (Expression) "]" {
    return {
      type: 'variable',
      path: variable
    }
  }

KeyWord
  = "$key" / "$" {
    return { p: true };
  }

WildWord
  = head:Word? "*" tail:Word? {
    const words = [];
    if (head) { words.push(head); }
    if (tail) { words.push(tail); }
    return {
      type: 'wildcard',
      words: words
    }
  }

ReverseWord
  = ".." {
    return null
  }

Word
  = [a-zA-Z0-9_]+ { return text(); }
