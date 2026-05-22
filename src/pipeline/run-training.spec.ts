import { runTraining } from './run-training'
import * as childProcess from 'child_process'

jest.mock('child_process')

const makeProc = (exitCode: number, stdoutLines: string[] = []) => ({
  stdout: {
    on: jest.fn().mockImplementation((event: string, cb: (_buf: Buffer) => void) => {
      if (event === 'data') stdoutLines.forEach(line => cb(Buffer.from(line)))
    }),
  },
  stderr: {
    on: jest.fn().mockImplementation((event: string, cb: (_buf: Buffer) => void) => {
      if (event === 'data') stdoutLines.forEach(line => cb(Buffer.from(line)))
    }),
  },
  on: jest.fn().mockImplementation((event: string, cb: (_code: number) => void) => {
    if (event === 'close') setTimeout(() => cb(exitCode), 0)
  }),
})

describe('runTraining', () => {
  it('calls ns-train splatfacto with correct args', async () => {
    const mockSpawn = jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    await runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', jest.fn())
    expect(mockSpawn).toHaveBeenCalledWith(
      'ns-train',
      expect.arrayContaining(['splatfacto', '--data', '/tmp/colmap', '--data.images-path', '/tmp/frames', '--output-dir', '/tmp/output']),
      expect.any(Object)
    )
  })

  it('calls onProgress with 100 on success', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', onProgress)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 100 }))
  })

  it('rejects on non-zero exit', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(1) as unknown as ReturnType<typeof childProcess.spawn>)
    await expect(runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', jest.fn()))
      .rejects.toThrow('ns-train exited with code 1')
  })

  it('parses iteration progress from Step N/M pattern', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0, ['Step 15000/30000']) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', onProgress)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 50, iteration: 15000 }))
  })

  it('parses iteration progress from bracket [N/M] pattern', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0, ['[9000/30000]']) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', onProgress)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ iteration: 9000 }))
  })

  it('ignores lines with no parseable iteration', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0, ['Loading data...']) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await runTraining('/tmp/colmap', '/tmp/frames', '/tmp/output', onProgress)
    // Only the final 100 call should happen
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 100 }))
  })
})
