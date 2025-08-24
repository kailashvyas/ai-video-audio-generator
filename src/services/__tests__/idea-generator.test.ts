/**
 * Unit tests for IdeaGenerator service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdeaGenerator, IdeaGeneratorConfig, GeneratedIdea } from '../idea-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';

// Mock the GeminiAPIManager
vi.mock('../../api/gemini-api-manager');

describe('IdeaGenerator', () => {
  let mockGeminiManager: vi.Mocked<GeminiAPIManager>;
  let ideaGenerator: IdeaGenerator;

  beforeEach(() => {
    mockGeminiManager = {
      generateText: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn(),
      generateAudio: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    ideaGenerator = new IdeaGenerator(mockGeminiManager);
  });

  describe('generateIdea', () => {
    it('should generate an idea from a topic', async () => {
      const mockResponse = `{
        "title": "The Secret Life of Urban Wildlife",
        "description": "Explore how animals adapt to city life in surprising ways.",
        "theme": "Urban wildlife adaptation",
        "targetAudience": "general",
        "estimatedDuration": 240,
        "keyPoints": ["Animal adaptation", "City ecosystems", "Coexistence"],
        "visualStyle": "Nature documentary with urban backdrop",
        "mood": "Wonder and discovery"
      }`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateIdea('urban wildlife');

      expect(result).toEqual({
        title: 'The Secret Life of Urban Wildlife',
        description: 'Explore how animals adapt to city life in surprising ways.',
        theme: 'Urban wildlife adaptation',
        targetAudience: 'general',
        estimatedDuration: 240,
        keyPoints: ['Animal adaptation', 'City ecosystems', 'Coexistence'],
        visualStyle: 'Nature documentary with urban backdrop',
        mood: 'Wonder and discovery'
      });

      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('urban wildlife'),
        'gemini-pro'
      );
    });

    it('should generate a random idea when no topic is provided', async () => {
      const mockResponse = `{
        "title": "Random Creative Idea",
        "description": "A randomly generated creative concept.",
        "theme": "Creativity",
        "targetAudience": "general",
        "estimatedDuration": 180,
        "keyPoints": ["Innovation", "Creativity", "Inspiration"],
        "visualStyle": "Modern and colorful",
        "mood": "Upbeat and inspiring"
      }`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateIdea();

      expect(result.title).toBe('Random Creative Idea');
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Generate a creative and original content idea'),
        'gemini-pro'
      );
    });

    it('should use custom configuration', async () => {
      const mockResponse = `{
        "title": "Educational Content",
        "description": "Learning focused content.",
        "theme": "Education",
        "targetAudience": "children",
        "estimatedDuration": 120,
        "keyPoints": ["Learning", "Fun", "Education"],
        "visualStyle": "Colorful and animated",
        "mood": "Fun and educational"
      }`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const config: IdeaGeneratorConfig = {
        contentType: 'educational',
        targetAudience: 'children',
        duration: 'short',
        creativity: 'high'
      };

      const result = await ideaGenerator.generateIdea('learning', config);

      expect(result.targetAudience).toBe('children');
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('educational'),
        'gemini-pro'
      );
    });

    it('should handle malformed JSON response with fallback parsing', async () => {
      const mockResponse = 'Title: Fallback Idea\nDescription: This is a fallback description';

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateIdea('test topic');

      expect(result.title).toBe('Fallback Idea');
      expect(result.description).toBe('This is a fallback description');
      expect(result.keyPoints).toEqual(['Engaging content', 'Visual storytelling', 'Audience connection']);
    });

    it('should handle API errors', async () => {
      mockGeminiManager.generateText.mockRejectedValue(new Error('API Error'));

      await expect(ideaGenerator.generateIdea('test')).rejects.toThrow('Failed to generate idea: API Error');
    });

    it('should validate required fields in response', async () => {
      const incompleteResponse = `{
        "title": "Incomplete Idea",
        "description": "Missing some fields"
      }`;

      mockGeminiManager.generateText.mockResolvedValue(incompleteResponse);

      const result = await ideaGenerator.generateIdea('test');

      // Should fall back to default parsing when required fields are missing
      expect(result.title).toBe('Incomplete Idea');
      expect(result.description).toBe('Missing some fields');
      // Default values should be used for missing fields
      expect(result.keyPoints).toEqual(['Engaging content', 'Visual storytelling', 'Audience connection']);
    });
  });

  describe('generateIdeaVariations', () => {
    it('should generate multiple idea variations', async () => {
      const mockResponse = `[
        {
          "title": "Variation 1",
          "description": "First variation description",
          "theme": "Theme 1",
          "targetAudience": "general",
          "estimatedDuration": 180,
          "keyPoints": ["Point 1", "Point 2"],
          "visualStyle": "Style 1",
          "mood": "Mood 1"
        },
        {
          "title": "Variation 2",
          "description": "Second variation description",
          "theme": "Theme 2",
          "targetAudience": "general",
          "estimatedDuration": 200,
          "keyPoints": ["Point 3", "Point 4"],
          "visualStyle": "Style 2",
          "mood": "Mood 2"
        }
      ]`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateIdeaVariations('test topic', 2);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Variation 1');
      expect(result[1].title).toBe('Variation 2');
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Generate 2 different creative content ideas'),
        'gemini-pro'
      );
    });

    it('should handle invalid array response', async () => {
      const mockResponse = 'Not a valid JSON array';

      mockGeminiManager.generateText.mockRejectedValue(new Error('Invalid response'));

      await expect(ideaGenerator.generateIdeaVariations('test', 3)).rejects.toThrow(
        'Failed to generate idea variations'
      );
    });
  });

  describe('generateTrendingTopic', () => {
    it('should generate a trending topic', async () => {
      const mockResponse = 'Sustainable living in 2024';

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateTrendingTopic();

      expect(result).toBe('Sustainable living in 2024');
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Generate a trending topic suggestion'),
        'gemini-pro'
      );
    });

    it('should clean up quoted responses', async () => {
      const mockResponse = '"Climate change solutions"';

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await ideaGenerator.generateTrendingTopic();

      expect(result).toBe('Climate change solutions');
    });

    it('should handle API errors for trending topics', async () => {
      mockGeminiManager.generateText.mockRejectedValue(new Error('Network error'));

      await expect(ideaGenerator.generateTrendingTopic()).rejects.toThrow(
        'Failed to generate trending topic: Network error'
      );
    });
  });

  describe('configuration handling', () => {
    it('should use default configuration when none provided', () => {
      const generator = new IdeaGenerator(mockGeminiManager);
      
      // Test that default config is applied by checking the prompt generation
      mockGeminiManager.generateText.mockResolvedValue('{}');
      
      generator.generateIdea('test');
      
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('entertainment'),
        'gemini-pro'
      );
    });

    it('should merge custom config with defaults', async () => {
      const customConfig: IdeaGeneratorConfig = {
        creativity: 'high',
        contentType: 'documentary'
      };

      const generator = new IdeaGenerator(mockGeminiManager, customConfig);
      
      mockGeminiManager.generateText.mockResolvedValue('{}');
      
      await generator.generateIdea('test');
      
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('documentary'),
        'gemini-pro'
      );
    });
  });

  describe('prompt building', () => {
    it('should include all configuration parameters in prompt', async () => {
      const config: IdeaGeneratorConfig = {
        contentType: 'educational',
        targetAudience: 'teens',
        duration: 'long',
        creativity: 'high'
      };

      mockGeminiManager.generateText.mockResolvedValue('{}');

      await ideaGenerator.generateIdea('science', config);

      const calledPrompt = mockGeminiManager.generateText.mock.calls[0][0];
      
      expect(calledPrompt).toContain('educational');
      expect(calledPrompt).toContain('teens');
      expect(calledPrompt).toContain('5-10 minutes');
      expect(calledPrompt).toContain('science');
    });

    it('should handle different creativity levels', async () => {
      mockGeminiManager.generateText.mockResolvedValue('{}');

      // Test low creativity
      await ideaGenerator.generateIdea('test', { creativity: 'low' });
      let prompt = mockGeminiManager.generateText.mock.calls[0][0];
      expect(prompt).toContain('practical, straightforward');

      // Test high creativity
      await ideaGenerator.generateIdea('test', { creativity: 'high' });
      prompt = mockGeminiManager.generateText.mock.calls[1][0];
      expect(prompt).toContain('highly creative and innovative');
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      mockGeminiManager.generateText.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(ideaGenerator.generateIdea('test')).rejects.toThrow(
        'Failed to generate idea: Rate limit exceeded'
      );
    });

    it('should handle unknown errors', async () => {
      mockGeminiManager.generateText.mockRejectedValue('Unknown error type');

      await expect(ideaGenerator.generateIdea('test')).rejects.toThrow(
        'Failed to generate idea: Unknown error'
      );
    });
  });
});