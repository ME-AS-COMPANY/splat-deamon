import { runColmap } from './run-colmap'
import * as childProcess from 'child_process'

jest.mock('child_process')
jest.mock('fs')

const makeProc = (exitCode: number) => ({
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn().mockImplementation((event: string, cb: (_code: number) => void) => {
    if (event === 'close') setTimeout(() => cb(exitCode), 0)
  }),
})

describe('runColmap', () => {
  it('calls colmap feature_extractor, exhaustive_matcher, mapper in order', async () => {
    const mockSpawn = jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    await runColmap('/tmp/frames', '/tmp/colmap', jest.fn())
    expect(mockSpawn).toHaveBeenCalledTimes(3)
    expect(mockSpawn).toHaveBeenNthCalledWith(1, 'colmap', expect.arrayContaining(['feature_extractor']), expect.any(Object))
    expect(mockSpawn).toHaveBeenNthCalledWith(2, 'colmap', expect.arrayContaining(['exhaustive_matcher']), expect.any(Object))
    expect(mockSpawn).toHaveBeenNthCalledWith(3, 'colmap', expect.arrayContaining(['mapper']), expect.any(Object))
  })

  it('passes image_path and database_path to feature_extractor', async () => {
    const mockSpawn = jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    await runColmap('/tmp/frames', '/tmp/colmap', jest.fn())
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      'colmap',
      expect.arrayContaining(['feature_extractor', '--image_path', '/tmp/frames']),
      expect.any(Object)
    )
  })

  it('reports progress at 33, 67, 100 after each step', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(0) as unknown as ReturnType<typeof childProcess.spawn>)
    const onProgress = jest.fn()
    await runColmap('/tmp/frames', '/tmp/colmap', onProgress)
    expect(onProgress.mock.calls.map((c: number[][]) => c[0])).toEqual([33, 67, 100])
  })

  it('rejects on non-zero exit from feature_extractor', async () => {
    jest.spyOn(childProcess, 'spawn')
      .mockReturnValue(makeProc(1) as unknown as ReturnType<typeof childProcess.spawn>)
    await expect(runColmap('/tmp/frames', '/tmp/colmap', jest.fn()))
      .rejects.toThrow('colmap feature_extractor exited with code 1')
  })
})
