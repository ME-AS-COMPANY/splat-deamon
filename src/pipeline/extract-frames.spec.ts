import { extractFrames } from './extract-frames'
import * as childProcess from 'child_process'

jest.mock('child_process')

const makeProc = (exitCode: number, stderrLines: string[] = [], stdoutLines: string[] = []) => ({
  stdout: {
    on: jest.fn().mockImplementation((event: string, cb: (_buf: Buffer) => void) => {
      if (event === 'data') stdoutLines.forEach(line => cb(Buffer.from(line)))
    }),
  },
  stderr: {
    on: jest.fn().mockImplementation((event: string, cb: (_buf: Buffer) => void) => {
      if (event === 'data') stderrLines.forEach(line => cb(Buffer.from(line)))
    }),
  },
  on: jest.fn().mockImplementation((event: string, cb: (_code: number) => void) => {
    if (event === 'close') setTimeout(() => cb(exitCode), 0)
  }),
})

describe('extractFrames', () => {
  it('calls ffmpeg with correct args', async () => {
    const mockSpawn = jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    await extractFrames('/tmp/video.mp4', '/tmp/frames', jest.fn())
    expect(mockSpawn).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', '/tmp/video.mp4', '-vf', 'fps=3']),
      expect.any(Object)
    )
  })

  it('calls onProgress with 100 on success', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await extractFrames('/tmp/video.mp4', '/tmp/frames', onProgress)
    expect(onProgress).toHaveBeenCalledWith(100)
  })

  it('rejects on non-zero exit code', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(1) as unknown as ReturnType<typeof childProcess.spawn>)
    await expect(extractFrames('/tmp/video.mp4', '/tmp/frames', jest.fn()))
      .rejects.toThrow('ffmpeg exited with code 1')
  })

  it('drains stdout without error', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0, [], ['some stdout data']) as unknown as ReturnType<typeof childProcess.spawn>)
    await expect(extractFrames('/tmp/video.mp4', '/tmp/frames', jest.fn())).resolves.toBeUndefined()
  })

  it('reports intermediate progress from stderr Duration+frame', async () => {
    const stderrLines = [
      'Duration: 00:02:00',
      'frame=   90',
    ]
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0, stderrLines) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await extractFrames('/tmp/video.mp4', '/tmp/frames', onProgress)
    // At frame=90 with totalFrames=360 (120s * 3fps), progress = ~25%
    const calls = onProgress.mock.calls.map((c: number[][]) => c[0])
    expect(calls.some((v: number) => v > 0 && v < 100)).toBe(true)
  })
})
