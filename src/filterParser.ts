export type FilterNode =
  | { type: 'tag'; value: string }
  | { type: 'and'; left: FilterNode; right: FilterNode }
  | { type: 'or'; left: FilterNode; right: FilterNode }
  | { type: 'not'; operand: FilterNode }

type Token =
  | { type: 'STRING'; value: string }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'NOT' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'EOF' }

function tokenize(input: string): Token[] | string {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
    } else if (ch === '"') {
      i++
      let value = ''
      while (i < input.length && input[i] !== '"') {
        value += input[i++]
      }
      if (i >= input.length) return 'Unterminated string literal'
      i++ // consume closing "
      tokens.push({ type: 'STRING', value })
    } else if (ch === '&' && input[i + 1] === '&') {
      tokens.push({ type: 'AND' })
      i += 2
    } else if (ch === '|' && input[i + 1] === '|') {
      tokens.push({ type: 'OR' })
      i += 2
    } else if (ch === '!') {
      tokens.push({ type: 'NOT' })
      i++
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' })
      i++
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' })
      i++
    } else {
      return `Unexpected character: "${ch}"`
    }
  }
  tokens.push({ type: 'EOF' })
  return tokens
}

class Parser {
  private pos = 0
  private tokens: Token[]
  constructor(tokens: Token[]) { this.tokens = tokens }

  private peek(): Token { return this.tokens[this.pos] }
  private consume(): Token { return this.tokens[this.pos++] }

  parse(): FilterNode | string {
    const result = this.parseOr()
    if (typeof result === 'string') return result
    if (this.peek().type !== 'EOF') return 'Unexpected token after expression'
    return result
  }

  private parseOr(): FilterNode | string {
    let left = this.parseAnd()
    if (typeof left === 'string') return left
    while (this.peek().type === 'OR') {
      this.consume()
      const right = this.parseAnd()
      if (typeof right === 'string') return right
      left = { type: 'or', left, right }
    }
    return left
  }

  private parseAnd(): FilterNode | string {
    let left = this.parseNot()
    if (typeof left === 'string') return left
    while (this.peek().type === 'AND') {
      this.consume()
      const right = this.parseNot()
      if (typeof right === 'string') return right
      left = { type: 'and', left, right }
    }
    return left
  }

  private parseNot(): FilterNode | string {
    if (this.peek().type === 'NOT') {
      this.consume()
      const operand = this.parsePrimary()
      if (typeof operand === 'string') return operand
      return { type: 'not', operand }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): FilterNode | string {
    const token = this.peek()
    if (token.type === 'STRING') {
      this.consume()
      return { type: 'tag', value: token.value }
    }
    if (token.type === 'LPAREN') {
      this.consume()
      const inner = this.parseOr()
      if (typeof inner === 'string') return inner
      if (this.peek().type !== 'RPAREN') return 'Expected closing parenthesis'
      this.consume()
      return inner
    }
    if (token.type === 'EOF') return 'Unexpected end of expression'
    return `Unexpected token`
  }
}

export function parseFilter(expression: string): FilterNode | string {
  const trimmed = expression.trim()
  if (!trimmed) return 'Expression is empty'
  const tokens = tokenize(trimmed)
  if (typeof tokens === 'string') return tokens
  return new Parser(tokens).parse()
}

export function evaluateFilter(node: FilterNode, tags: string[]): boolean {
  switch (node.type) {
    case 'tag': return tags.includes(node.value)
    case 'and': return evaluateFilter(node.left, tags) && evaluateFilter(node.right, tags)
    case 'or': return evaluateFilter(node.left, tags) || evaluateFilter(node.right, tags)
    case 'not': return !evaluateFilter(node.operand, tags)
  }
}
