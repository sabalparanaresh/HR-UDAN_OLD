import { invoke } from '@tauri-apps/api/tauri';

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export class BaseService {
  /**
   * Universal wrapper for Tauri IPC calls.
   * Centralizes error catching, mapping, and potentially logging or retry logic.
   */
  protected static async call<T>(command: string, args?: Record<string, any>): Promise<T> {
    try {
      const response = await invoke<T>(command, args);
      return response;
    } catch (error: any) {
      // Intercept and normalize the error before passing it to the UI
      const normalizedError: ApiError = {
        message: typeof error === 'string' ? error : (error?.message || 'An unknown error occurred in the backend'),
        details: error,
      };
      
      console.error(`[API Error] Command: ${command}`, normalizedError);
      
      throw normalizedError;
    }
  }
}
