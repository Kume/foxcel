Expression
  = JoinedPath / AbsolutePath

AbsolutePath
  = "/" path: JoinedPath {
    return [{type: 'absolute'}, ...path]
  }

JoinedPath
  = context:(ContextWord "/")? head:(ReversePath "/")? tail:ForwardPath {
    head = Array.isArray(head) ? head[0] : [];
    if (context) {
      head = [context[0]].concat(head);
    }
    return head.concat(tail || []);
  }

ReversePath
  = head:(ReverseWord) tail:("/" ReversePath)? {
    let words = [head];
    if (Array.isArray(tail)) {
      words = words.concat(tail[1]);
    }
    return words;
  }

ForwardPath
  = head:(KeyWord / WildWord / Word / PathVariable) tail:("/" ForwardPath)? {
    let words = [head];
    if (Array.isArray(tail)) {
      words = words.concat(tail[1]);
    }
    return words;
  }

PathVariable
  = "[" variable: (AbsolutePath / JoinedPath) "]" {
    return {
      type: 'variable',
      path: variable
    }
  }

KeyWord
  = "$key" {
    return { type: "key" };
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
    return { type: 'parent' }
  }

ContextWord
  = ".." key:Word {
    return { type: 'context', key }
  }

Word
  = [a-zA-Z0-9_]+ { return text(); }