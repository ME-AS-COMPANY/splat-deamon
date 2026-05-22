import { processJob } from './pipeline'
import { ApiClient, Job } from './api-client'
import * as extractFramesModule from './pipeline/extract-frames'
import * as runColmapModule from './pipeline/run-colmap'
import * as runTrainingModule from './pipeline/run-training'
import * as uploadPlyModule from './pipeline/upload-ply'
import * as fs from 'fs'

jest.mock('./pipeline/extract-frames')
jest.mock('./pipeline/run-colmap')
jest.mock('./pipeline/run-training')
jest.mock('./pipeline/upload-ply')
jest.mock('fs')

const mockJob: Job = {
  id: 'job-1',
  name: 'test.mp4',
  status: 'processing',
  step: '',
  progress: 0,
  etaSeconds: 0,
  plyUrl: null,
  errorMessage: null,
  startedAt: new Date().toISOString(),
  createdAt: '',
  updatedAt: '',
}

const r2Config = {
  accountId: 'a',
  accessKeyId: 'k',
  secretAccessKey: 's',
  bucketName: 'b',
  publicBaseUrl: 'https://pub.r2.dev',
}

type CancelSequence = Array<'processing' | 'cancelled'>

function makeClient(cancelSequence: CancelSequence = []) {
  let callCount = 0
  return {
    updateJob: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockImplementation(() => {
      const status = cancelSequence[callCount++] ?? 'processing'
      return Promise.resolve({ ...mockJob, status })
    }),
    listPending: jest.fn(),
  }
}

function mockFetch(): void {
  const arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(0))
  global.fetch = jest.fn().mockResolvedValue({ arrayBuffer })
}

describe('processJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch()
    jest.spyOn(extractFramesModule, 'extractFrames').mockImplementation((_v, _f, onProgress) => {
      onProgress(50)
      return Promise.resolve()
    })
    jest.spyOn(runColmapModule, 'runColmap').mockImplementation((_f, _o, onProgress) => {
      onProgress(50)
      return Promise.resolve()
    })
    jest.spyOn(runTrainingModule, 'runTraining').mockImplementation((_c, _i, _o, onProgress) => {
      onProgress({ progress: 50, etaSeconds: 10, iteration: 15000 })
      return Promise.resolve()
    })
    jest.spyOn(uploadPlyModule, 'uploadPly').mockResolvedValue('https://pub.r2.dev/output/job-1/scene.ply')
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)
    jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['scene.ply'] as unknown as ReturnType<typeof fs.readdirSync>)
    jest.spyOn(fs, 'rmSync').mockReturnValue(undefined)
  })

  it('runs full pipeline and marks job done', async () => {
    const client = makeClient(['processing', 'processing', 'processing']) as unknown as ApiClient
    await processJob(mockJob, client, '/tmp/work', r2Config)
    expect(extractFramesModule.extractFrames).toHaveBeenCalled()
    expect(runColmapModule.runColmap).toHaveBeenCalled()
    expect(runTrainingModule.runTraining).toHaveBeenCalled()
    expect(uploadPlyModule.uploadPly).toHaveBeenCalled()
    expect(client.updateJob).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'done' }))
  })

  it('stops after frames if job cancelled', async () => {
    const client = makeClient(['cancelled']) as unknown as ApiClient
    await processJob(mockJob, client, '/tmp/work', r2Config)
    expect(extractFramesModule.extractFrames).toHaveBeenCalled()
    expect(runColmapModule.runColmap).not.toHaveBeenCalled()
    expect(client.updateJob).not.toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'done' }))
  })

  it('stops after colmap if job cancelled', async () => {
    const client = makeClient(['processing', 'cancelled']) as unknown as ApiClient
    await processJob(mockJob, client, '/tmp/work', r2Config)
    expect(runColmapModule.runColmap).toHaveBeenCalled()
    expect(runTrainingModule.runTraining).not.toHaveBeenCalled()
    expect(client.updateJob).not.toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'done' }))
  })

  it('stops after training if job cancelled', async () => {
    const client = makeClient(['processing', 'processing', 'cancelled']) as unknown as ApiClient
    await processJob(mockJob, client, '/tmp/work', r2Config)
    expect(runTrainingModule.runTraining).toHaveBeenCalled()
    expect(uploadPlyModule.uploadPly).not.toHaveBeenCalled()
    expect(client.updateJob).not.toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'done' }))
  })

  it('cleans up work dir after completion', async () => {
    const client = makeClient(['processing', 'processing', 'processing']) as unknown as ApiClient
    await processJob(mockJob, client, '/tmp/work', r2Config)
    expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('job-1'), expect.objectContaining({ recursive: true }))
  })

  it('throws if no ply file found after training', async () => {
    jest.spyOn(fs, 'readdirSync').mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>)
    const client = makeClient(['processing', 'processing', 'processing']) as unknown as ApiClient
    await expect(processJob(mockJob, client, '/tmp/work', r2Config)).rejects.toThrow('No .ply file found after training')
  })
})
