import { ApiClient, Job } from './api-client'
import { processJob } from './pipeline'
import type { R2Config } from './pipeline/upload-ply'

const API_URL = process.env.API_URL ?? 'http://localhost:8787'
const WORK_DIR = process.env.WORK_DIR ?? '/tmp/splat-studio-work'

const r2Config: R2Config = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucketName: process.env.R2_BUCKET_NAME ?? 'splat-studio-bucket',
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
}

const client = new ApiClient(API_URL)

async function processWithLog(job: Job): Promise<void> {
  console.log(`[daemon] Processing ${job.id} — ${job.name}`)
  await processJob(job, client, WORK_DIR, r2Config)
  console.log(`[daemon] Done: ${job.id}`)
}

async function handleError(jobId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[daemon] Error on ${jobId}:`, message)
  await client.updateJob(jobId, { status: 'error', errorMessage: message })
}

async function poll(): Promise<void> {
  const pending = await client.listPending()
  if (pending.length === 0) return
  const job = pending[0]
  try {
    await processWithLog(job)
  } catch (err) {
    await handleError(job.id, err)
  }
}

console.log('[daemon] Starting. Polling every 5s...')
poll()
setInterval(poll, 5_000)
