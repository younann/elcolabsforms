export type JobEvent = 'created' | 'inspector' | 'forms' | 'cancelled';

// web push lands later
export async function notifyJob(_event: JobEvent, _jobId: string, _inspectorIds: string[]): Promise<void> {}
