export interface Job {
  id: string
  name: string
  status: 'pending' | 'processing' | 'done' | 'error' | 'cancelled'
  step: string
  progress: number
  etaSeconds: number
  plyUrl: string | null
  errorMessage: string | null
  startedAt: string | null
  createdAt: string
  updatedAt: string
}

type JobUpdate = Partial<
  Pick<Job, 'status' | 'step' | 'progress' | 'etaSeconds' | 'plyUrl' | 'errorMessage' | 'startedAt'>
> & { logLines?: string }

export class ApiClient {
  private readonly base: string

  constructor(baseUrl: string) {
    this.base = baseUrl
  }

  get baseUrl(): string { return this.base }

  async listPending(): Promise<Job[]> {
    const res = await fetch(`${this.base}/jobs?status=pending`)
    const data = (await res.json()) as { jobs: Job[] }
    return data.jobs.filter((job) => job.status === 'pending')
  }

  async getJob(id: string): Promise<Job> {
    const res = await fetch(`${this.base}/jobs/${id}`)
    return res.json() as Promise<Job>
  }

  async updateJob(id: string, update: JobUpdate): Promise<void> {
    await fetch(`${this.base}/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
  }
}
