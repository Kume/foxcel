module.exports =
  /*
   * Generated by PEG.js 0.10.0.
   *
   * http://pegjs.org/
   */
  (function () {
    'use strict';

    function peg$subclass(child, parent) {
      function ctor() {
        this.constructor = child;
      }
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
    }

    function peg$SyntaxError(message, expected, found, location) {
      this.message = message;
      this.expected = expected;
      this.found = found;
      this.location = location;
      this.name = 'SyntaxError';

      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, peg$SyntaxError);
      }
    }

    peg$subclass(peg$SyntaxError, Error);

    peg$SyntaxError.buildMessage = function (expected, found) {
      var DESCRIBE_EXPECTATION_FNS = {
        literal: function (expectation) {
          return '"' + literalEscape(expectation.text) + '"';
        },

        class: function (expectation) {
          var escapedParts = '',
            i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts +=
              expectation.parts[i] instanceof Array
                ? classEscape(expectation.parts[i][0]) + '-' + classEscape(expectation.parts[i][1])
                : classEscape(expectation.parts[i]);
          }

          return '[' + (expectation.inverted ? '^' : '') + escapedParts + ']';
        },

        any: function (expectation) {
          return 'any character';
        },

        end: function (expectation) {
          return 'end of input';
        },

        other: function (expectation) {
          return expectation.description;
        },
      };

      function hex(ch) {
        return ch.charCodeAt(0).toString(16).toUpperCase();
      }

      function literalEscape(s) {
        return s
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\0/g, '\\0')
          .replace(/\t/g, '\\t')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/[\x00-\x0F]/g, function (ch) {
            return '\\x0' + hex(ch);
          })
          .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) {
            return '\\x' + hex(ch);
          });
      }

      function classEscape(s) {
        return s
          .replace(/\\/g, '\\\\')
          .replace(/\]/g, '\\]')
          .replace(/\^/g, '\\^')
          .replace(/-/g, '\\-')
          .replace(/\0/g, '\\0')
          .replace(/\t/g, '\\t')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/[\x00-\x0F]/g, function (ch) {
            return '\\x0' + hex(ch);
          })
          .replace(/[\x10-\x1F\x7F-\x9F]/g, function (ch) {
            return '\\x' + hex(ch);
          });
      }

      function describeExpectation(expectation) {
        return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
      }

      function describeExpected(expected) {
        var descriptions = new Array(expected.length),
          i,
          j;

        for (i = 0; i < expected.length; i++) {
          descriptions[i] = describeExpectation(expected[i]);
        }

        descriptions.sort();

        if (descriptions.length > 0) {
          for (i = 1, j = 1; i < descriptions.length; i++) {
            if (descriptions[i - 1] !== descriptions[i]) {
              descriptions[j] = descriptions[i];
              j++;
            }
          }
          descriptions.length = j;
        }

        switch (descriptions.length) {
          case 1:
            return descriptions[0];

          case 2:
            return descriptions[0] + ' or ' + descriptions[1];

          default:
            return descriptions.slice(0, -1).join(', ') + ', or ' + descriptions[descriptions.length - 1];
        }
      }

      function describeFound(found) {
        return found ? '"' + literalEscape(found) + '"' : 'end of input';
      }

      return 'Expected ' + describeExpected(expected) + ' but ' + describeFound(found) + ' found.';
    };

    function peg$parse(input, options) {
      options = options !== void 0 ? options : {};

      var peg$FAILED = {},
        peg$startRuleFunctions = {Expression: peg$parseExpression},
        peg$startRuleFunction = peg$parseExpression,
        peg$c0 = '/',
        peg$c1 = peg$literalExpectation('/', false),
        peg$c2 = function (path) {
          return [{type: 'absolute'}, ...path];
        },
        peg$c3 = function (context, head, tail) {
          head = Array.isArray(head) ? head[0] : [];
          if (context) {
            head = [context[0]].concat(head);
          }
          return head.concat(tail || []);
        },
        peg$c4 = function (head, tail) {
          let words = [head];
          if (Array.isArray(tail)) {
            words = words.concat(tail[1]);
          }
          return words;
        },
        peg$c5 = '[',
        peg$c6 = peg$literalExpectation('[', false),
        peg$c7 = ']',
        peg$c8 = peg$literalExpectation(']', false),
        peg$c9 = function (variable) {
          return {
            type: 'variable',
            path: variable,
          };
        },
        peg$c10 = '$key',
        peg$c11 = peg$literalExpectation('$key', false),
        peg$c12 = function () {
          return {type: 'key'};
        },
        peg$c13 = '*',
        peg$c14 = peg$literalExpectation('*', false),
        peg$c15 = function (head, tail) {
          const words = [];
          if (head) {
            words.push(head);
          }
          if (tail) {
            words.push(tail);
          }
          return {
            type: 'wildcard',
            words: words,
          };
        },
        peg$c16 = '..',
        peg$c17 = peg$literalExpectation('..', false),
        peg$c18 = function () {
          return {type: 'parent'};
        },
        peg$c19 = function (key) {
          return {type: 'context', key};
        },
        peg$c20 = /^[a-zA-Z0-9_]/,
        peg$c21 = peg$classExpectation([['a', 'z'], ['A', 'Z'], ['0', '9'], '_'], false, false),
        peg$c22 = function () {
          return text();
        },
        peg$currPos = 0,
        peg$savedPos = 0,
        peg$posDetailsCache = [{line: 1, column: 1}],
        peg$maxFailPos = 0,
        peg$maxFailExpected = [],
        peg$silentFails = 0,
        peg$result;

      if ('startRule' in options) {
        if (!(options.startRule in peg$startRuleFunctions)) {
          throw new Error('Can\'t start parsing from rule "' + options.startRule + '".');
        }

        peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
      }

      function text() {
        return input.substring(peg$savedPos, peg$currPos);
      }

      function location() {
        return peg$computeLocation(peg$savedPos, peg$currPos);
      }

      function expected(description, location) {
        location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos);

        throw peg$buildStructuredError(
          [peg$otherExpectation(description)],
          input.substring(peg$savedPos, peg$currPos),
          location,
        );
      }

      function error(message, location) {
        location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos);

        throw peg$buildSimpleError(message, location);
      }

      function peg$literalExpectation(text, ignoreCase) {
        return {type: 'literal', text: text, ignoreCase: ignoreCase};
      }

      function peg$classExpectation(parts, inverted, ignoreCase) {
        return {type: 'class', parts: parts, inverted: inverted, ignoreCase: ignoreCase};
      }

      function peg$anyExpectation() {
        return {type: 'any'};
      }

      function peg$endExpectation() {
        return {type: 'end'};
      }

      function peg$otherExpectation(description) {
        return {type: 'other', description: description};
      }

      function peg$computePosDetails(pos) {
        var details = peg$posDetailsCache[pos],
          p;

        if (details) {
          return details;
        } else {
          p = pos - 1;
          while (!peg$posDetailsCache[p]) {
            p--;
          }

          details = peg$posDetailsCache[p];
          details = {
            line: details.line,
            column: details.column,
          };

          while (p < pos) {
            if (input.charCodeAt(p) === 10) {
              details.line++;
              details.column = 1;
            } else {
              details.column++;
            }

            p++;
          }

          peg$posDetailsCache[pos] = details;
          return details;
        }
      }

      function peg$computeLocation(startPos, endPos) {
        var startPosDetails = peg$computePosDetails(startPos),
          endPosDetails = peg$computePosDetails(endPos);

        return {
          start: {
            offset: startPos,
            line: startPosDetails.line,
            column: startPosDetails.column,
          },
          end: {
            offset: endPos,
            line: endPosDetails.line,
            column: endPosDetails.column,
          },
        };
      }

      function peg$fail(expected) {
        if (peg$currPos < peg$maxFailPos) {
          return;
        }

        if (peg$currPos > peg$maxFailPos) {
          peg$maxFailPos = peg$currPos;
          peg$maxFailExpected = [];
        }

        peg$maxFailExpected.push(expected);
      }

      function peg$buildSimpleError(message, location) {
        return new peg$SyntaxError(message, null, null, location);
      }

      function peg$buildStructuredError(expected, found, location) {
        return new peg$SyntaxError(peg$SyntaxError.buildMessage(expected, found), expected, found, location);
      }

      function peg$parseExpression() {
        var s0;

        s0 = peg$parseJoinedPath();
        if (s0 === peg$FAILED) {
          s0 = peg$parseAbsolutePath();
        }

        return s0;
      }

      function peg$parseAbsolutePath() {
        var s0, s1, s2;

        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 47) {
          s1 = peg$c0;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c1);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseJoinedPath();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c2(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseJoinedPath() {
        var s0, s1, s2, s3, s4;

        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$parseContextWord();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c0;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c1);
            }
          }
          if (s3 !== peg$FAILED) {
            s2 = [s2, s3];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
        if (s1 === peg$FAILED) {
          s1 = null;
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          s3 = peg$parseReversePath();
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 47) {
              s4 = peg$c0;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c1);
              }
            }
            if (s4 !== peg$FAILED) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = null;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseForwardPath();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c3(s1, s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseReversePath() {
        var s0, s1, s2, s3, s4;

        s0 = peg$currPos;
        s1 = peg$parseReverseWord();
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c0;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c1);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parseReversePath();
            if (s4 !== peg$FAILED) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = null;
          }
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c4(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseForwardPath() {
        var s0, s1, s2, s3, s4;

        s0 = peg$currPos;
        s1 = peg$parseKeyWord();
        if (s1 === peg$FAILED) {
          s1 = peg$parseWildWord();
          if (s1 === peg$FAILED) {
            s1 = peg$parseWord();
            if (s1 === peg$FAILED) {
              s1 = peg$parsePathVariable();
            }
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c0;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c1);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parseForwardPath();
            if (s4 !== peg$FAILED) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = null;
          }
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c4(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parsePathVariable() {
        var s0, s1, s2, s3;

        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 91) {
          s1 = peg$c5;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c6);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAbsolutePath();
          if (s2 === peg$FAILED) {
            s2 = peg$parseJoinedPath();
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 93) {
              s3 = peg$c7;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c8);
              }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c9(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseKeyWord() {
        var s0, s1;

        s0 = peg$currPos;
        if (input.substr(peg$currPos, 4) === peg$c10) {
          s1 = peg$c10;
          peg$currPos += 4;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c11);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c12();
        }
        s0 = s1;

        return s0;
      }

      function peg$parseWildWord() {
        var s0, s1, s2, s3;

        s0 = peg$currPos;
        s1 = peg$parseWord();
        if (s1 === peg$FAILED) {
          s1 = null;
        }
        if (s1 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 42) {
            s2 = peg$c13;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c14);
            }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseWord();
            if (s3 === peg$FAILED) {
              s3 = null;
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c15(s1, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseReverseWord() {
        var s0, s1;

        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c16) {
          s1 = peg$c16;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c17);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c18();
        }
        s0 = s1;

        return s0;
      }

      function peg$parseContextWord() {
        var s0, s1, s2;

        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c16) {
          s1 = peg$c16;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c17);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseWord();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c19(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }

        return s0;
      }

      function peg$parseWord() {
        var s0, s1, s2;

        s0 = peg$currPos;
        s1 = [];
        if (peg$c20.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c21);
          }
        }
        if (s2 !== peg$FAILED) {
          while (s2 !== peg$FAILED) {
            s1.push(s2);
            if (peg$c20.test(input.charAt(peg$currPos))) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c21);
              }
            }
          }
        } else {
          s1 = peg$FAILED;
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c22();
        }
        s0 = s1;

        return s0;
      }

      peg$result = peg$startRuleFunction();

      if (peg$result !== peg$FAILED && peg$currPos === input.length) {
        return peg$result;
      } else {
        if (peg$result !== peg$FAILED && peg$currPos < input.length) {
          peg$fail(peg$endExpectation());
        }

        throw peg$buildStructuredError(
          peg$maxFailExpected,
          peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
          peg$maxFailPos < input.length
            ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
            : peg$computeLocation(peg$maxFailPos, peg$maxFailPos),
        );
      }
    }

    return {
      SyntaxError: peg$SyntaxError,
      parse: peg$parse,
    };
  })();
