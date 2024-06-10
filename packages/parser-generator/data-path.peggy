Expression
  = AbsolutePath / ContextPath / RelativePath

AbsolutePath
  = "/" path: (ForwardPath / KeyToken) {
    return {t: 'abs', ...path}
  }

ContextPath
  = key:Word ":" reverse:(ReverseToken "/")* path:(ForwardPath / KeyToken) {
  	return {t: 'ctx', r: reverse.length, key, ...path}
  }

RelativePath
  = reverse:(ReverseToken "/")* path:(ForwardPath / KeyToken) {
  	return {t: 'rel', r: reverse.length, ...path}
  }


ForwardPath
  = path:JoinedPath pointsKey:("/" KeyToken)? {
    return {...path, p: !!pointsKey || undefined};
  }

JoinedPath
  = first: GeneralPathComponent components: ("/" GeneralPathComponent)* {
    return {c: [first].concat(components.map(([_, w]) => w))}
  }

GeneralPathComponent = WildToken / Word / NestedPath / PathAlias / QuotedWord

PathAlias
  = "@" name:Word {
    return {type: 'alias', name}
  }

NestedPath
  = "[" nested: (Expression) "]" {
    return {
      type: 'nested',
      path: nested
    }
  }

KeyToken
  = "$key" / "$" {
    return { p: true };
  }

WildToken
  = "*" {
    return {type: 'wildcard'}
  }

ReverseToken
  = ".." {
    return null
  }

QuotedWord
  = components:QuotedWordComponent+ {
    return components.join('"')
  }

QuotedWordComponent
  = '"' word:[^"]+ '"' {
    return word.join('');
  }

Word
  = [a-zA-Z0-9_]+ { return text(); }
