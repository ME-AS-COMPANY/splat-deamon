import { spawn } from 'child_process'
import { existsSync, symlinkSync } from 'fs'
import { join } from 'path'
import { calcEta } from '../eta'

function emitLines(text: string, onLog: ((_line: string) => void) | undefined): void {
  if (!onLog) return
  text.split('\n').filter((l) => l.trim()).forEach((l) => onLog(l))
}

const TOTAL_ITERATIONS = 100

interface ProgressUpdate {
  progress: number
  etaSeconds: number
  iteration: number
}

function parseIteration(text: string): number | null {
  const stepMatch = text.match(/Step (\d+)\/(\d+)/)
  if (stepMatch) return parseInt(stepMatch[1])
  const bracketMatch = text.match(/\[(\d+)\/(\d+)\]/)
  if (bracketMatch) return parseInt(bracketMatch[1])
  return null
}

export function runTraining(
  colmapDir: string,
  imagesDir: string,
  outputDir: string,
  onProgress: (_update: ProgressUpdate) => void,
  onLog?: (_line: string) => void
): Promise<void> {
  const imagesLink = join(colmapDir, 'images')
  if (!existsSync(imagesLink)) symlinkSync(imagesDir, imagesLink)

  return new Promise((resolve, reject) => {
    const args = [
      'splatfacto',
      '--output-dir', outputDir,
      '--machine.device-type', 'cuda',
      '--pipeline.model.num-downscales', '0',
      '--max-num-iterations', '100',
      'colmap',
      '--data', colmapDir,
      '--colmap-path', 'sparse/0',
      '--downscale-factor', '1',
    ]
    const proc = spawn('ns-train', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const startedAt = Date.now()

    const handleOutput = (text: string) => {
      const iteration = parseIteration(text)
      if (iteration !== null) {
        const progress = Math.min(99, Math.round((iteration / TOTAL_ITERATIONS) * 100))
        onProgress({ progress, etaSeconds: calcEta(progress, Date.now() - startedAt), iteration })
      }
      emitLines(text, onLog)
    }

    proc.stdout.on('data', (chunk: Buffer) => handleOutput(chunk.toString()))
    proc.stderr.on('data', (chunk: Buffer) => handleOutput(chunk.toString()))

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ns-train exited with code ${code}`))
      onProgress({ progress: 100, etaSeconds: 0, iteration: TOTAL_ITERATIONS })
      resolve()
    })
  })
}
