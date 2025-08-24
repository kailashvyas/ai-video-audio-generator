/**
 * Retry handler with exponential backoff for API operations
 */

import { APIError, ErrorResolution } from '../types';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      exponentialBase: config.exponentialBase || 2,
      jitter: config.jitter !== false
    };
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'API Operation'
  ): Promise<T> {
    let lastError: APIError | Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as APIError | Error;
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, error);
        
        console.warn(
          `${operationName} failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}). ` +
          `Retrying in ${delay}ms. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Determine if an error should be retried
   */
  private isRetryableError(error: any): boolean {
    // If it's an APIError with retryable flag
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // Check for specific error codes/types
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'RATE_LIMIT_EXCEEDED',
      'TEMPORARY_FAILURE',
      'SERVICE_UNAVAILABLE'
    ];

    // Check error code
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // Check HTTP status codes (5xx server errors)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Check for specific 4xx errors that might be retryable
    if (error.status === 429) { // Too Many Requests
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, error: any): number {
    // Use specific retry delay if provided by the error
    if (error.retryAfter) {
      return Math.min(error.retryAfter, this.config.maxDelay);
    }

    // Calculate exponential backoff delay
    let delay = this.config.baseDelay * Math.pow(this.config.exponentialBase, attempt);
    
    // Apply jitter to avoid thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    // Cap at maximum delay
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error resolution strategy
   */
  getErrorResolution(error: APIError): ErrorResolution {
    if (error.retryable) {
      return {
        action: 'retry',
        delay: error.retryAfter || this.config.baseDelay
      };
    }

    // Check if we should try a fallback
    if (this.shouldUseFallback(error)) {
      return {
        action: 'fallback',
        fallbackPrompt: this.generateFallbackPrompt(error)
      };
    }

    return {
      action: 'abort'
    };
  }

  /**
   * Determine if a fallback strategy should be used
   */
  private shouldUseFallback(error: APIError): boolean {
    const fallbackErrors = [
      'QUOTA_EXCEEDED',
      'MODEL_UNAVAILABLE',
      'CONTENT_FILTERED'
    ];

    return fallbackErrors.includes(error.code);
  }

  /**
   * Generate a fallback prompt for content filtering issues
   */
  private generateFallbackPrompt(error: APIError): string {
    if (error.code === 'CONTENT_FILTERED') {
      return 'Please rephrase the request to be more appropriate and family-friendly.';
    }

    if (error.code === 'MODEL_UNAVAILABLE') {
      return 'The requested model is unavailable. Using alternative approach.';
    }

    return 'Attempting alternative approach due to API limitations.';
  }
}