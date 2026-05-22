const MAX_LINES = 150

export class LogBuffer {
  private lines: string[] = []

  push(prefix: string, text: string): string[] {
    const newLines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `[${prefix}] ${line}`)
    this.lines = [...this.lines, ...newLines].slice(-MAX_LINES)
    return newLines
  }

  getAll(): string[] {
    return this.lines
  }

  toJson(): string {
    return JSON.stringify(this.lines)
  }
}
