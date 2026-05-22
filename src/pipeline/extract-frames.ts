import { spawn } from 'child_process'
import path from 'path'

function parseTotalFrames(text: string): number {
  const durMatch = text.match(/Duration: (\d+):(\d+):(\d+)/)
  if (!durMatch) return 0
  const secs = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3])
  return Math.ceil(secs * 3)
}

function parseCurrentFrame(text: string): number {
  const frameMatch = text.match(/frame=\s*(\d+)/)
  return frameMatch ? parseInt(frameMatch[1]) : 0
}

function calcProgress(current: number, total: number): number | null {
  if (current <= 0 || total <= 0) return null
  return Math.min(99, Math.round((current / total) * 100))
}

function emitLines(text: string, onLog: ((_line: string) => void) | undefined): void {
  if (!onLog) return
  text.split('\n').filter((l) => l.trim()).forEach((l) => onLog(l))
}

export function extractFrames(
  videoPath: string,
  outputDir: string,
  onProgress: (_pct: number) => void,
  onLog?: (_line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vf', 'fps=3',
      '-qscale:v', '1',
      '-qmin', '1',
      path.join(outputDir, '%04d.jpg'),
    ]
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let totalFrames = 0

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      const parsed = parseTotalFrames(text)
      if (parsed > 0) totalFrames = parsed
      const pct = calcProgress(parseCurrentFrame(text), totalFrames)
      if (pct !== null) onProgress(pct)
      emitLines(text, onLog)
    })

    proc.stdout.on('data', () => { /* drain */ })

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with code ${code}`))
      onProgress(100)
      resolve()
    })
  })
}
