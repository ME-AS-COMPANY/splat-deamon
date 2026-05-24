import { spawn } from 'child_process'
import { existsSync, readdirSync, symlinkSync } from 'fs'
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

function findConfigYml(outputDir: string): string {
  const files = readdirSync(outputDir, { recursive: true }) as string[]
  const config = files.find((f) => f.endsWith('config.yml'))
  if (!config) throw new Error('config.yml not found after training')
  return join(outputDir, config)
}

function spawnProcess(cmd: string, args: string[], onLog?: (_line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    proc.stdout.on('data', (c: Buffer) => emitLines(c.toString(), onLog))
    proc.stderr.on('data', (c: Buffer) => emitLines(c.toString(), onLog))
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} exited with code ${code}`))
      resolve()
    })
  })
}

export async function runTraining(
  colmapDir: string,
  imagesDir: string,
  outputDir: string,
  onProgress: (_update: ProgressUpdate) => void,
  onLog?: (_line: string) => void
): Promise<void> {
  const imagesLink = join(colmapDir, 'images')
  if (!existsSync(imagesLink)) symlinkSync(imagesDir, imagesLink)

  const startedAt = Date.now()

  await new Promise<void>((resolve, reject) => {
    const args = [
      'splatfacto',
      '--output-dir', outputDir,
      '--machine.device-type', 'cuda',
      '--pipeline.model.num-downscales', '0',
      '--max-num-iterations', '100',
      '--viewer.quit-on-train-completion', 'True',
      'colmap',
      '--data', colmapDir,
      '--colmap-path', 'sparse/0',
      '--downscale-factor', '1',
    ]
    const proc = spawn('ns-train', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    const handleOutput = (text: string) => {
      const iteration = parseIteration(text)
      if (iteration !== null) {
        const progress = Math.min(99, Math.round((iteration / TOTAL_ITERATIONS) * 100))
        onProgress({ progress, etaSeconds: calcEta(progress, Date.now() - startedAt), iteration })
      }
      emitLines(text, onLog)
    }

    proc.stdout.on('data', (c: Buffer) => handleOutput(c.toString()))
    proc.stderr.on('data', (c: Buffer) => handleOutput(c.toString()))
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ns-train exited with code ${code}`))
      onProgress({ progress: 100, etaSeconds: 0, iteration: TOTAL_ITERATIONS })
      resolve()
    })
  })

  onLog?.('[export] Exporting gaussian splat to .ply...')
  const configPath = findConfigYml(outputDir)
  const exportDir = join(outputDir, 'export')
  await spawnProcess('ns-export', ['gaussian-splat', '--load-config', configPath, '--output-dir', exportDir], onLog)
  onLog?.('[export] Done.')
}
