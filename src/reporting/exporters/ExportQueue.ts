import { IBaseExporter } from './types';

export interface ExportJob {
  id: string;
  exporter: IBaseExporter;
  fileName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  error?: string;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

class ExportQueueManager {
  private queue: ExportJob[] = [];
  private isProcessing = false;

  public addJob(job: Omit<ExportJob, 'status' | 'progress'>): string {
    const newJob: ExportJob = {
      ...job,
      status: 'PENDING',
      progress: 0
    };
    this.queue.push(newJob);
    this.processNext();
    return job.id;
  }

  public getJob(id: string): ExportJob | undefined {
    return this.queue.find(j => j.id === id);
  }

  private async processNext() {
    if (this.isProcessing) return;

    const job = this.queue.find(j => j.status === 'PENDING');
    if (!job) return;

    this.isProcessing = true;
    job.status = 'PROCESSING';
    job.progress = 10;

    try {
      // Small artificial delay to simulate heavy processing and allow UI to update if needed
      await new Promise(res => setTimeout(res, 50));
      
      job.progress = 50;
      const result = await job.exporter.export(job.fileName);
      
      job.progress = 100;
      job.status = 'COMPLETED';
      
      if (result && job.onComplete) {
        job.onComplete(result as Blob);
      }
    } catch (e: any) {
      job.status = 'FAILED';
      job.error = e.message;
      if (job.onError) {
        job.onError(e);
      }
    } finally {
      this.isProcessing = false;
      this.processNext(); // Process subsequent jobs
    }
  }
}

export const ExportQueue = new ExportQueueManager();
