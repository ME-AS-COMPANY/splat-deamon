import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicBaseUrl: string
}

export async function uploadPly(localPath: string, jobId: string, config: R2Config): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const key = `output/${jobId}/scene.ply`
  const body = fs.createReadStream(localPath)

  await client.send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: body,
    ContentType: 'application/octet-stream',
  }))

  return `${config.publicBaseUrl}/${key}`
}
