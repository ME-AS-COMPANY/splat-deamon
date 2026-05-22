import { LogBuffer } from './log-buffer'

describe('LogBuffer', () => {
  it('prefixes lines', () => {
    const buf = new LogBuffer()
    buf.push('ffmpeg', 'frame=100\nfps=30')
    expect(buf.getAll()).toEqual(['[ffmpeg] frame=100', '[ffmpeg] fps=30'])
  })

  it('caps at 150 lines', () => {
    const buf = new LogBuffer()
    for (let i = 0; i < 200; i++) buf.push('test', `line ${i}`)
    expect(buf.getAll().length).toBe(150)
  })

  it('serializes to JSON', () => {
    const buf = new LogBuffer()
    buf.push('colmap', 'Reconstructing')
    expect(JSON.parse(buf.toJson())).toContain('[colmap] Reconstructing')
  })

  it('filters blank lines', () => {
    const buf = new LogBuffer()
    buf.push('ffmpeg', '\n\n  \nframe=1')
    expect(buf.getAll()).toEqual(['[ffmpeg] frame=1'])
  })

  it('returns new lines from push', () => {
    const buf = new LogBuffer()
    const result = buf.push('test', 'a\nb')
    expect(result).toEqual(['[test] a', '[test] b'])
  })
})
