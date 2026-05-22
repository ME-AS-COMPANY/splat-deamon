import fs from 'fs'
import path from 'path'
import { ApiClient, Job } from './api-client'
import { R2Config, uploadPly } from './pipeline/upload-ply'
import { extractFrames } from './pipeline/extract-frames'
import { runColmap } from './pipeline/run-colmap'
import { runTraining } from './pipeline/run-training'
import { LogBuffer } from './log-buffer'

async function isCancelled(client: ApiClient, jobId: string): Promise<boolean> {
  const job = await client.getJob(jobId)
  return job.status === 'cancelled'
}

function buildPaths(workDir: string, jobId: string, fileName = 'video.mp4') {
  const base = path.join(workDir, jobId)
  return {
    base,
    video: path.join(base, fileName),
    frames: path.join(base, 'frames'),
    colmap: path.join(base, 'colmap'),
    output: path.join(base, 'output'),
  }
}

async function downloadVideo(videoUrl: string, dest: string): Promise<void> {
  const res = await fetch(videoUrl)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function findPly(outputDir: string): string {
  const files = fs.readdirSync(outputDir, { recursive: true }) as string[]
  const ply = files.find((file) => file.endsWith('.ply'))
  if (!ply) throw new Error('No .ply file found after training')
  return path.join(outputDir, ply)
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

type Paths = ReturnType<typeof buildPaths>

async function runFramesAndColmap(job: Job, client: ApiClient, paths: Paths, logBuf: LogBuffer): Promise<boolean> {
  await extractFrames(paths.video, paths.frames, (pct) => {
    void client.updateJob(job.id, { step: 'frames', progress: Math.round(pct * 0.05) })
  }, (line) => logBuf.push('ffmpeg', line))
  if (await isCancelled(client, job.id)) return false

  await client.updateJob(job.id, { step: 'colmap', progress: 5 })
  await runColmap(paths.frames, paths.colmap, (pct) => {
    void client.updateJob(job.id, { step: 'colmap', progress: 5 + Math.round(pct * 0.25) })
  }, (line) => logBuf.push('colmap', line))
  return !(await isCancelled(client, job.id))
}

async function runTrainingAndUpload(job: Job, client: ApiClient, paths: Paths, r2Config: R2Config, logBuf: LogBuffer): Promise<void> {
  await client.updateJob(job.id, { step: 'training', progress: 30 })
  await runTraining(paths.colmap, paths.frames, paths.output, ({ progress, etaSeconds }) => {
    void client.updateJob(job.id, { step: 'training', progress: 30 + Math.round(progress * 0.65), etaSeconds })
  }, (line) => logBuf.push('training', line))
  if (await isCancelled(client, job.id)) return

  await client.updateJob(job.id, { step: 'upload', progress: 95 })
  const plyPath = findPly(paths.output)
  const plyUrl = await uploadPly(plyPath, job.id, r2Config)
  await client.updateJob(job.id, { status: 'done', step: 'done', progress: 100, plyUrl, etaSeconds: 0 })
}

async function runStages(job: Job, client: ApiClient, paths: Paths, r2Config: R2Config, logBuf: LogBuffer): Promise<void> {
  const shouldContinue = await runFramesAndColmap(job, client, paths, logBuf)
  if (!shouldContinue) {
    cleanup(paths.base)
    return
  }
  await runTrainingAndUpload(job, client, paths, r2Config, logBuf)
  cleanup(paths.base)
}

export async function processJob(
  job: Job,
  client: ApiClient,
  workDir: string,
  r2Config: R2Config
): Promise<void> {
  const ext = path.extname(job.name) || '.mp4'
  const paths = buildPaths(workDir, job.id, `video${ext}`)
  fs.mkdirSync(paths.frames, { recursive: true })
  fs.mkdirSync(paths.colmap, { recursive: true })
  fs.mkdirSync(paths.output, { recursive: true })

  await client.updateJob(job.id, {
    status: 'processing',
    startedAt: new Date().toISOString(),
    step: 'frames',
    progress: 0,
  })

  const logBuf = new LogBuffer()
  const flushLogs = async () => { await client.updateJob(job.id, { logLines: logBuf.toJson() }) }
  const logFlushTimer = setInterval(() => { void flushLogs() }, 2000)

  const videoUrl = `${client.baseUrl}/jobs/${job.id}/video`
  await downloadVideo(videoUrl, paths.video)

  try {
    await runStages(job, client, paths, r2Config, logBuf)
  } finally {
    clearInterval(logFlushTimer)
    await flushLogs()
  }
}
