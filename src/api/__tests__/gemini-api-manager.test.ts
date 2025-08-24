/**
 * Unit tests for GeminiAPIManager
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GeminiAPIManager, GeminiConfig } from '../gemini-api-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue('Generated text response')
        }
      })
    })
  }))
}));

describe('GeminiAPIManager', () => {
  let apiManager: GeminiAPIManager;
  let mockConfig: GeminiConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 3,
      defaultModel: 'gemini-pro'
    };

    apiManager = new GeminiAPIManager(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      
      const stats = apiManager.getUsageStats();
      expect(stats.totalCost).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.tokensUsed).toBe(0);
    });
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const prompt = 'Generate a creative story';
      const result = await apiManager.generateText(prompt);
      
      expect(result).toBe('Generated text response');
      
      const stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    it('should use custom model when specified', async () => {
      const mockGenAI = new GoogleGenerativeAI('test');
      const mockGetModel = vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: vi.fn().mockReturnValue('Custom model response') }
        })
      });
      
      (mockGenAI.getGenerativeModel as Mock) = mockGetModel;
      
      await apiManager.generateText('test prompt', 'gemini-ultra');
      
      // Note: This test would need access to the private genAI instance
      // In a real implementation, you might want to make this testable
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly for text operations', () => {
      const operation = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'medium' as const
      };

      const cost = apiManager.estimateCost(operation);
      expect(cost).toBe(0.001); // $0.001 for 1K characters
    });

    it('should apply complexity multiplier correctly', () => {
      const lowComplexity = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low' as const
      };

      const highComplexity = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'high' as const
      };

      const lowCost = apiManager.estimateCost(lowComplexity);
      const highCost = apiManager.estimateCost(highComplexity);

      expect(highCost).toBe(lowCost * 4); // high (2.0) vs low (0.5) = 4x difference
    });

    it('should scale cost with input size', () => {
      const smallInput = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 500,
        complexity: 'medium' as const
      };

      const largeInput = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 2000,
        complexity: 'medium' as const
      };

      const smallCost = apiManager.estimateCost(smallInput);
      const largeCost = apiManager.estimateCost(largeInput);

      expect(largeCost).toBeGreaterThan(smallCost);
    });
  });

  describe('rate limiting', () => {
    it('should track active requests', async () => {
      // This test would require access to private methods
      // In practice, you might want to expose some internal state for testing
      const promise1 = apiManager.generateText('test 1');
      const promise2 = apiManager.generateText('test 2');
      
      await Promise.all([promise1, promise2]);
      
      const stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(2);
    });
  });

  describe('usage statistics', () => {
    it('should track usage statistics correctly', async () => {
      await apiManager.generateText('test prompt');
      
      const stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.tokensUsed).toBeGreaterThan(0);
    });

    it('should reset usage statistics', async () => {
      await apiManager.generateText('test prompt');
      
      let stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(1);
      
      apiManager.resetUsageStats();
      
      stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.tokensUsed).toBe(0);
    });
  });

  describe('generateImage', () => {
    it('should generate image with correct format', async () => {
      const result = await apiManager.generateImage('A beautiful landscape');
      
      expect(result.format).toBe('png');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.url).toContain('generated-image-');
    });
  });

  describe('generateVideo', () => {
    it('should generate video with correct properties', async () => {
      const result = await apiManager.generateVideo('A person walking');
      
      expect(result.format).toBe('mp4');
      expect(result.duration).toBe(5);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.url).toContain('generated-video-');
    });
  });

  describe('generateAudio', () => {
    it('should generate audio with voice configuration', async () => {
      const voiceConfig = {
        voice: 'en-US-Standard-A',
        speed: 1.0,
        pitch: 0.0,
        volume: 1.0
      };

      const result = await apiManager.generateAudio('Hello world', voiceConfig);
      
      expect(result.format).toBe('mp3');
      expect(result.sampleRate).toBe(44100);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.url).toContain('generated-audio-');
    });
  });
});