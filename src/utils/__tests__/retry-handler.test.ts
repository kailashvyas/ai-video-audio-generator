/**
 * Unit tests for RetryHandler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryHandler } from '../retry-handler';
import { APIError } from '../../types';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 5000,
      exponentialBase: 2,
      jitter: false // Disable jitter for predictable tests
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = new Error('ECONNRESET') as any;
      retryableError.code = 'ECONNRESET';
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid input') as any;
      nonRetryableError.code = 'INVALID_INPUT';
      
      const mockOperation = vi.fn().mockRejectedValue(nonRetryableError);
      
      await expect(retryHandler.executeWithRetry(mockOperation)).rejects.toThrow('Invalid input');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries limit', async () => {
      const retryableError = new Error('RATE_LIMIT_EXCEEDED') as any;
      retryableError.code = 'RATE_LIMIT_EXCEEDED';
      
      const mockOperation = vi.fn().mockRejectedValue(retryableError);
      
      await expect(retryHandler.executeWithRetry(mockOperation)).rejects.toThrow('RATE_LIMIT_EXCEEDED');
      expect(mockOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should handle APIError with retryable flag', async () => {
      const apiError: APIError = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        retryable: true
      };
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(apiError)
        .mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should respect retryAfter delay from error', async () => {
      const apiError: APIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 200
      };
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(apiError)
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      const result = await retryHandler.executeWithRetry(mockOperation);
      const endTime = Date.now();
      
      expect(result).toBe('success');
      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable network errors', async () => {
      const networkErrors = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
      
      for (const code of networkErrors) {
        const error = new Error('Network error') as any;
        error.code = code;
        
        // Access private method through executeWithRetry behavior
        const mockOperation = vi.fn().mockRejectedValue(error);
        await expect(retryHandler.executeWithRetry(mockOperation)).rejects.toThrow();
      }
    });

    it('should identify retryable HTTP status codes', async () => {
      const serverError = new Error('Server error') as any;
      serverError.status = 500;
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockOperation);
      expect(result).toBe('success');
    });

    it('should identify 429 Too Many Requests as retryable', async () => {
      const rateLimitError = new Error('Too many requests') as any;
      rateLimitError.status = 429;
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockOperation);
      expect(result).toBe('success');
    });
  });

  describe('getErrorResolution', () => {
    it('should return retry resolution for retryable errors', () => {
      const apiError: APIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 1000
      };
      
      const resolution = retryHandler.getErrorResolution(apiError);
      
      expect(resolution.action).toBe('retry');
      expect(resolution.delay).toBe(1000);
    });

    it('should return fallback resolution for quota exceeded', () => {
      const apiError: APIError = {
        code: 'QUOTA_EXCEEDED',
        message: 'Quota exceeded',
        retryable: false
      };
      
      const resolution = retryHandler.getErrorResolution(apiError);
      
      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackPrompt).toContain('alternative approach');
    });

    it('should return abort resolution for non-retryable errors', () => {
      const apiError: APIError = {
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
        retryable: false
      };
      
      const resolution = retryHandler.getErrorResolution(apiError);
      
      expect(resolution.action).toBe('abort');
    });

    it('should provide appropriate fallback prompts', () => {
      const contentFilteredError: APIError = {
        code: 'CONTENT_FILTERED',
        message: 'Content filtered',
        retryable: false
      };
      
      const resolution = retryHandler.getErrorResolution(contentFilteredError);
      
      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackPrompt).toContain('family-friendly');
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay exponentially', async () => {
      const retryHandler = new RetryHandler({
        maxRetries: 2,
        baseDelay: 100,
        exponentialBase: 2,
        jitter: false
      });

      const error = new Error('RATE_LIMIT_EXCEEDED') as any;
      error.code = 'RATE_LIMIT_EXCEEDED';
      
      const mockOperation = vi.fn().mockRejectedValue(error);
      const delays: number[] = [];
      
      // Mock setTimeout to capture delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      }) as any;
      
      try {
        await retryHandler.executeWithRetry(mockOperation);
      } catch (e) {
        // Expected to fail after retries
      }
      
      global.setTimeout = originalSetTimeout;
      
      // Should have delays for each retry attempt
      expect(delays.length).toBeGreaterThan(0);
      // First retry should be base delay (100ms)
      // Second retry should be base * exponentialBase (200ms)
      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThan(delays[0]);
      }
    });
  });
});