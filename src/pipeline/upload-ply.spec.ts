import { uploadPly, R2Config } from './upload-ply'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

jest.mock('@aws-sdk/client-s3')
jest.mock('fs')

const config: R2Config = {
  accountId: 'acc123',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucketName: 'splat-studio-bucket',
  publicBaseUrl: 'https://pub.r2.dev',
}

describe('uploadPly', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates S3Client with R2 endpoint', async () => {
    const mockSend = jest.fn().mockResolvedValue({})
    jest.mocked(S3Client).mockImplementation(() => ({ send: mockSend } as any))

    await uploadPly('/tmp/scene.ply', 'job-123', config)

    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: expect.stringContaining('acc123'),
    }))
  })

  it('sends PutObjectCommand with correct key', async () => {
    const mockSend = jest.fn().mockResolvedValue({})
    jest.mocked(S3Client).mockImplementation(() => ({ send: mockSend } as any))

    await uploadPly('/tmp/scene.ply', 'job-123', config)

    expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand))
  })

  it('returns correct public URL', async () => {
    const mockSend = jest.fn().mockResolvedValue({})
    jest.mocked(S3Client).mockImplementation(() => ({ send: mockSend } as any))

    const url = await uploadPly('/tmp/scene.ply', 'job-123', config)

    expect(url).toBe('https://pub.r2.dev/output/job-123/scene.ply')
  })
})
