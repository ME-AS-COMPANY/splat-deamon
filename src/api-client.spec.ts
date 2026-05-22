import { ApiClient } from './api-client'

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockJob = {
  id: '1',
  name: 'test.mp4',
  status: 'pending' as const,
  step: '',
  progress: 0,
  etaSeconds: 0,
  plyUrl: null,
  errorMessage: null,
  startedAt: null,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => mockFetch.mockReset())

describe('ApiClient.listPending', () => {
  it('returns pending jobs', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ jobs: [mockJob] }) })
    const client = new ApiClient('http://localhost:8787')
    const jobs = await client.listPending()
    expect(jobs).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8787/jobs?status=pending')
  })

  it('filters out non-pending jobs returned by API', async () => {
    const doneJob = { ...mockJob, status: 'done' as const }
    mockFetch.mockResolvedValueOnce({ json: async () => ({ jobs: [mockJob, doneJob] }) })
    const client = new ApiClient('http://localhost:8787')
    const jobs = await client.listPending()
    expect(jobs).toHaveLength(1)
  })
})

describe('ApiClient.getJob', () => {
  it('returns job by id', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => mockJob })
    const client = new ApiClient('http://localhost:8787')
    const job = await client.getJob('1')
    expect(job.id).toBe('1')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8787/jobs/1')
  })
})

describe('ApiClient.updateJob', () => {
  it('sends PUT to /jobs/:id', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ ok: true }) })
    const client = new ApiClient('http://localhost:8787')
    await client.updateJob('1', { status: 'processing', step: 'frames', progress: 10 })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/jobs/1',
      expect.objectContaining({ method: 'PUT' })
    )
  })
})
