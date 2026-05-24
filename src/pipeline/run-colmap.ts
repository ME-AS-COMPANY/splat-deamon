import { spawn } from 'child_process'
import { mkdirSync } from 'fs'
import { join } from 'path'

function emitChunk(chunk: Buffer, onLog: ((_line: string) => void) | undefined): void {
  if (!onLog) return
  chunk
    .toString()
    .split('\n')
    .filter(Boolean)
    .forEach((l) => onLog(l))
}

function spawnStep(subcommand: string, args: string[], onLog?: (_line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('colmap', [subcommand, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' },
    })
    proc.stdout.on('data', (c: Buffer) => emitChunk(c, onLog))
    proc.stderr.on('data', (c: Buffer) => emitChunk(c, onLog))
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`colmap ${subcommand} exited with code ${code}`))
      resolve()
    })
  })
}

export async function runColmap(
  framesDir: string,
  outputDir: string,
  onProgress: (_pct: number) => void,
  onLog?: (_line: string) => void
): Promise<void> {
  const dbPath = join(outputDir, 'database.db')
  const sparsePath = join(outputDir, 'sparse')
  mkdirSync(sparsePath, { recursive: true })

  const steps: [string, string[]][] = [
    ['feature_extractor', ['--database_path', dbPath, '--image_path', framesDir, '--ImageReader.single_camera', '1', '--ImageReader.camera_model', 'OPENCV', '--SiftExtraction.use_gpu', '0', '--SiftExtraction.max_image_size', '800']],
    ['exhaustive_matcher', ['--database_path', dbPath, '--SiftMatching.use_gpu', '0']],
    ['mapper', ['--database_path', dbPath, '--image_path', framesDir, '--output_path', sparsePath]],
  ]

  for (let i = 0; i < steps.length; i++) {
    const [subcommand, args] = steps[i]
    await spawnStep(subcommand, args, onLog)
    onProgress(Math.round(((i + 1) / steps.length) * 100))
  }
}
