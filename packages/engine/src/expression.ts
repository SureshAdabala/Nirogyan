type Token =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'identifier'; readonly value: string }
  | { readonly kind: 'operator'; readonly value: string }
  | { readonly kind: 'eof'; readonly value: '' };

export interface ExpressionEnvironment {
  readonly values: Readonly<Record<string, unknown>>;
  readonly lookup?: (table: string, input: unknown) => unknown;
}

const FUNCTIONS = new Set([
  'abs',
  'exp',
  'ln',
  'log10',
  'lookup',
  'max',
  'min',
  'pow',
  'round',
  'sqrt',
  'sum',
  'weightedSum',
]);

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const pushOperator = (value: string) => tokens.push({ kind: 'operator', value });
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[0-9.]/.test(source[index]!)) index += 1;
      if (source[index] === 'e' || source[index] === 'E') {
        index += 1;
        if (source[index] === '+' || source[index] === '-') index += 1;
        while (index < source.length && /[0-9]/.test(source[index]!)) index += 1;
      }
      const raw = source.slice(start, index);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid numeric literal "${raw}".`);
      tokens.push({ kind: 'number', value });
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      index += 1;
      let value = '';
      let closed = false;
      while (index < source.length) {
        const current = source[index]!;
        if (current === '\\') {
          const next = source[index + 1];
          if (!next) throw new Error('Unterminated string escape.');
          value += next;
          index += 2;
        } else if (current === quote) {
          index += 1;
          closed = true;
          break;
        } else {
          value += current;
          index += 1;
        }
      }
      if (!closed) throw new Error('Unterminated string literal.');
      tokens.push({ kind: 'string', value });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index]!)) index += 1;
      tokens.push({ kind: 'identifier', value: source.slice(start, index) });
      continue;
    }
    const two = source.slice(index, index + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
      pushOperator(two);
      index += 2;
      continue;
    }
    if ('+-*/%<>()?,:!'.includes(char)) {
      pushOperator(char);
      index += 1;
      continue;
    }
    throw new Error(`Unsupported character "${char}".`);
  }
  tokens.push({ kind: 'eof', value: '' });
  return tokens;
}

type Ast =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'identifier'; readonly name: string }
  | { readonly kind: 'unary'; readonly op: string; readonly value: Ast }
  | { readonly kind: 'binary'; readonly op: string; readonly left: Ast; readonly right: Ast }
  | { readonly kind: 'conditional'; readonly test: Ast; readonly yes: Ast; readonly no: Ast }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly Ast[] };

class Parser {
  private index = 0;
  public constructor(private readonly tokens: readonly Token[]) {}

  public parse(): Ast {
    const result = this.parseConditional();
    if (this.peek().kind !== 'eof')
      throw new Error(`Unexpected token ${this.describe(this.peek())}.`);
    return result;
  }

  private parseConditional(): Ast {
    const test = this.parseOr();
    if (this.match('?')) {
      const yes = this.parseConditional();
      this.expect(':');
      const no = this.parseConditional();
      return { kind: 'conditional', test, yes, no };
    }
    return test;
  }

  private parseOr(): Ast {
    return this.parseLeft(this.parseAnd.bind(this), ['||']);
  }

  private parseAnd(): Ast {
    return this.parseLeft(this.parseComparison.bind(this), ['&&']);
  }

  private parseComparison(): Ast {
    return this.parseLeft(this.parseAdditive.bind(this), ['==', '!=', '<', '<=', '>', '>=']);
  }

  private parseAdditive(): Ast {
    return this.parseLeft(this.parseMultiplicative.bind(this), ['+', '-']);
  }

  private parseMultiplicative(): Ast {
    return this.parseLeft(this.parseUnary.bind(this), ['*', '/', '%']);
  }

  private parseLeft(next: () => Ast, operators: readonly string[]): Ast {
    let left = next();
    while (this.peek().kind === 'operator' && operators.includes(this.peek().value as string)) {
      const op = this.take().value as string;
      left = { kind: 'binary', op, left, right: next() };
    }
    return left;
  }

  private parseUnary(): Ast {
    if (this.match('!') || this.match('+') || this.match('-')) {
      const op = this.previous().value as string;
      return { kind: 'unary', op, value: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Ast {
    const token = this.take();
    if (token.kind === 'number' || token.kind === 'string')
      return { kind: 'literal', value: token.value };
    if (token.kind === 'identifier') {
      if (this.match('(')) {
        const args: Ast[] = [];
        if (!this.match(')')) {
          do args.push(this.parseConditional());
          while (this.match(','));
          this.expect(')');
        }
        if (!FUNCTIONS.has(token.value))
          throw new Error(`Function "${token.value}" is not permitted.`);
        return { kind: 'call', name: token.value, args };
      }
      if (token.value === 'true') return { kind: 'literal', value: true };
      if (token.value === 'false') return { kind: 'literal', value: false };
      if (token.value === 'null') return { kind: 'literal', value: null };
      return { kind: 'identifier', name: token.value };
    }
    if (token.kind === 'operator' && token.value === '(') {
      const result = this.parseConditional();
      this.expect(')');
      return result;
    }
    throw new Error(`Unexpected token ${this.describe(token)}.`);
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: 'eof', value: '' };
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? { kind: 'eof', value: '' };
  }

  private take(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private match(value: string): boolean {
    if (this.peek().kind === 'operator' && this.peek().value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expect(value: string): void {
    if (!this.match(value)) throw new Error(`Expected "${value}".`);
  }

  private describe(token: Token): string {
    return token.kind === 'eof' ? 'end of expression' : String(token.value);
  }
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number.`);
  return value;
}

function evaluate(ast: Ast, env: ExpressionEnvironment): unknown {
  switch (ast.kind) {
    case 'literal':
      return ast.value;
    case 'identifier': {
      if (!(ast.name in env.values)) throw new Error(`Unknown symbol "${ast.name}".`);
      return env.values[ast.name];
    }
    case 'unary': {
      const value = evaluate(ast.value, env);
      if (ast.op === '!') return !value;
      const numeric = number(value, 'Unary operand');
      return ast.op === '-' ? -numeric : numeric;
    }
    case 'conditional':
      return evaluate(ast.test, env) ? evaluate(ast.yes, env) : evaluate(ast.no, env);
    case 'binary': {
      if (ast.op === '&&')
        return Boolean(evaluate(ast.left, env)) && Boolean(evaluate(ast.right, env));
      if (ast.op === '||')
        return Boolean(evaluate(ast.left, env)) || Boolean(evaluate(ast.right, env));
      const left = evaluate(ast.left, env);
      const right = evaluate(ast.right, env);
      if (['==', '!='].includes(ast.op))
        return ast.op === '==' ? Object.is(left, right) : !Object.is(left, right);
      if (['<', '<=', '>', '>='].includes(ast.op)) {
        if (typeof left !== 'number' || typeof right !== 'number')
          throw new Error('Comparisons require numeric operands.');
        if (ast.op === '<') return left < right;
        if (ast.op === '<=') return left <= right;
        if (ast.op === '>') return left > right;
        return left >= right;
      }
      const a = number(left, 'Left operand');
      const b = number(right, 'Right operand');
      if (ast.op === '+') return a + b;
      if (ast.op === '-') return a - b;
      if (ast.op === '*') return a * b;
      if (ast.op === '/') {
        if (b === 0) throw new Error('Division by zero.');
        return a / b;
      }
      return a % b;
    }
    case 'call': {
      const args = ast.args.map((arg) => evaluate(arg, env));
      switch (ast.name) {
        case 'abs':
          return Math.abs(number(args[0], 'abs argument'));
        case 'exp':
          return Math.exp(number(args[0], 'exp argument'));
        case 'ln': {
          const value = number(args[0], 'ln argument');
          if (value <= 0) throw new Error('ln argument must be greater than zero.');
          return Math.log(value);
        }
        case 'log10': {
          const value = number(args[0], 'log10 argument');
          if (value <= 0) throw new Error('log10 argument must be greater than zero.');
          return Math.log10(value);
        }
        case 'max':
          return Math.max(...args.map((value) => number(value, 'max argument')));
        case 'min':
          return Math.min(...args.map((value) => number(value, 'min argument')));
        case 'pow':
          return Math.pow(number(args[0], 'pow base'), number(args[1], 'pow exponent'));
        case 'round': {
          const value = number(args[0], 'round argument');
          const places = args.length > 1 ? number(args[1], 'round places') : 0;
          if (!Number.isInteger(places) || places < 0 || places > 12)
            throw new Error('round places must be an integer from 0 through 12.');
          const factor = 10 ** places;
          return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
        }
        case 'sqrt': {
          const value = number(args[0], 'sqrt argument');
          if (value < 0) throw new Error('sqrt argument must be non-negative.');
          return Math.sqrt(value);
        }
        case 'sum': {
          const list = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          return (list as unknown[]).reduce<number>(
            (total, value) => total + number(value, 'sum item'),
            0,
          );
        }
        case 'weightedSum': {
          const object = args[0];
          if (object === null || typeof object !== 'object' || Array.isArray(object))
            throw new Error('weightedSum requires a domain map.');
          return Object.values(object as Record<string, unknown>).reduce<number>((total, item) => {
            if (item === null || typeof item !== 'object')
              throw new Error('weightedSum domain entries are objects.');
            const entry = item as Record<string, unknown>;
            return (
              total +
              number(entry.value, 'weightedSum value') * number(entry.weight, 'weightedSum weight')
            );
          }, 0);
        }
        case 'lookup': {
          if (!env.lookup) throw new Error('No lookup resolver is configured.');
          return env.lookup(String(args[0]), args[1]);
        }
        default:
          throw new Error(`Function "${ast.name}" is not permitted.`);
      }
    }
  }
}

function astStats(ast: Ast, depth = 1): { readonly nodes: number; readonly depth: number } {
  switch (ast.kind) {
    case 'literal':
    case 'identifier':
      return { nodes: 1, depth };
    case 'unary': {
      const child = astStats(ast.value, depth + 1);
      return { nodes: 1 + child.nodes, depth: child.depth };
    }
    case 'binary': {
      const left = astStats(ast.left, depth + 1);
      const right = astStats(ast.right, depth + 1);
      return { nodes: 1 + left.nodes + right.nodes, depth: Math.max(left.depth, right.depth) };
    }
    case 'conditional': {
      const test = astStats(ast.test, depth + 1);
      const yes = astStats(ast.yes, depth + 1);
      const no = astStats(ast.no, depth + 1);
      return {
        nodes: 1 + test.nodes + yes.nodes + no.nodes,
        depth: Math.max(test.depth, yes.depth, no.depth),
      };
    }
    case 'call': {
      const children = ast.args.map((arg) => astStats(arg, depth + 1));
      return {
        nodes: 1 + children.reduce((total, child) => total + child.nodes, 0),
        depth: children.reduce((max, child) => Math.max(max, child.depth), depth),
      };
    }
  }
}

export function evaluateExpression(source: string, environment: ExpressionEnvironment): unknown {
  if (source.length > 2048) throw new Error('Expression exceeds the 2048-character limit.');
  const ast = new Parser(tokenize(source)).parse();
  const stats = astStats(ast);
  if (stats.nodes > 256) throw new Error('Expression exceeds the 256-node limit.');
  if (stats.depth > 32) throw new Error('Expression nesting exceeds the depth limit of 32.');
  const result = evaluate(ast, environment);
  if (typeof result === 'number' && !Number.isFinite(result))
    throw new Error('Expression result must be finite.');
  if (typeof result === 'number' && Math.abs(result) > 1e15)
    throw new Error('Expression result exceeds the magnitude limit.');
  return result;
}
