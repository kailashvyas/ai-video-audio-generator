/**
 * Integration tests for Veo video generation through Gemini API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiAPIManager, GeminiConfig } from '../gemini-api-manager';

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue('Video generation response')
        }
      })
    })
  }))
}));

describe('Veo Integration', () => {
  let apiManager: GeminiAPIManager;
  let mockConfig: GeminiConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 3,
      defaultModel: 'gemini-2.0-flash-exp'
    };

    apiManager = new GeminiAPIManager(mockConfig);
  });

  describe('generateVideo', () => {
    it('should generate video with text prompt only', async () => {
      const prompt = 'A person walking through a beautiful forest';
      const result = await apiManager.generateVideo(prompt);
      
      expect(result.format).toBe('mp4');
      expect(result.duration).toBe(5);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.url).toContain('generated-video-');
      
      const stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    it('should generate video with text prompt and reference image', async () => {
      const prompt = 'A person walking through a beautiful forest';
      const referenceImage = 'base64encodedimagedata'; // Mock base64 image
      
      const result = await apiManager.generateVideo(prompt, referenceImage);
      
      expect(result.format).toBe('mp4');
      expect(result.url).toContain('generated-video-');
      
      const stats = apiManager.getUsageStats();
      expect(stats.requestCount).toBe(1);
      // Cost should be higher due to reference image
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    it('should use custom model when specified', async () => {
      const prompt = 'A scenic landscape with mountains';
      const customModel = 'gemini-2.0-flash-exp';
      
      const result = await apiManager.generateVideo(prompt, undefined, customModel);
      
      expect(result).toBeDefined();
      expect(result.format).toBe('mp4');
    });

    it('should handle video generation errors gracefully', async () => {
      // Mock an error response
      const mockGenAI = apiManager as any;
      const originalGenAI = mockGenAI.genAI;
      
      mockGenAI.genAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockRejectedValue(new Error('API Error'))
        })
      };

      const prompt = 'A test video prompt';
      
      await expect(apiManager.generateVideo(prompt)).rejects.toThrow();
      
      // Restore original
      mockGenAI.genAI = originalGenAI;
    });

    it('should estimate costs correctly for video generation', () => {
      const operation = {
        type: 'video' as const,
        model: 'gemini-2.0-flash-exp',
        inputSize: 1000,
        complexity: 'high' as const
      };

      const cost = apiManager.estimateCost(operation);
      
      // Video should be more expensive than text
      expect(cost).toBeGreaterThan(0.1); // Base video cost is $0.10
      
      const textOperation = {
        type: 'text' as const,
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'medium' as const
      };
      
      const textCost = apiManager.estimateCost(textOperation);
      expect(cost).toBeGreaterThan(textCost);
    });
  });

  describe('generateImage with updated model', () => {
    it('should use gemini-2.0-flash-exp by default for images', async () => {
      const prompt = 'A beautiful sunset over the ocean';
      const result = await apiManager.generateImage(prompt);
      
      expect(result.format).toBe('png');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.url).toContain('generated-image-');
    });
  });
});