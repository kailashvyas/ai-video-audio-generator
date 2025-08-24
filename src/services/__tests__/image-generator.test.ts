/**
 * Unit tests for ImageGenerator service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageGenerator, ImageGenerationConfig, CharacterImageRequest } from '../image-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { Character } from '../../types/content';
import { ImageResult } from '../../types/api';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');

describe('ImageGenerator', () => {
  let imageGenerator: ImageGenerator;
  let mockApiManager: GeminiAPIManager;
  let testStorageDir: string;

  const mockCharacter: Character = {
    name: 'John Doe',
    description: 'A tall man with brown hair and blue eyes, wearing a red jacket',
    appearances: []
  };

  const mockConfig: ImageGenerationConfig = {
    style: 'realistic',
    quality: 'standard',
    aspectRatio: '1:1',
    resolution: 'medium'
  };

  const mockImageResult: ImageResult = {
    url: 'https://example.com/image.png',
    format: 'png',
    width: 1024,
    height: 1024,
    size: 2048000
  };

  beforeEach(() => {
    testStorageDir = './test-images';
    
    // Mock API Manager
    mockApiManager = {
      generateImage: vi.fn(),
      generateText: vi.fn(),
      generateVideo: vi.fn(),
      generateAudio: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    // Mock fs functions
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('{}');
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    imageGenerator = new ImageGenerator(mockApiManager, testStorageDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCharacterImage', () => {
    it('should generate character image successfully', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      const result = await imageGenerator.generateCharacterImage(request);

      expect(result).toBeDefined();
      expect(result.characterName).toBe(mockCharacter.name);
      expect(result.url).toBe(mockImageResult.url);
      expect(result.metadata.dimensions.width).toBe(1024);
      expect(result.metadata.dimensions.height).toBe(1024);
      expect(mockApiManager.generateImage).toHaveBeenCalledOnce();
    });

    it('should build correct prompt for character image', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig,
        additionalPrompts: ['professional lighting', 'studio background']
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      await imageGenerator.generateCharacterImage(request);

      const expectedPromptParts = [
        'Character reference image of John Doe',
        'A tall man with brown hair and blue eyes, wearing a red jacket',
        'photorealistic, high detail, professional photography',
        'good quality, clear features',
        'aspect ratio 1:1',
        'resolution 1024x1024',
        'professional lighting',
        'studio background'
      ];

      const actualPrompt = vi.mocked(mockApiManager.generateImage).mock.calls[0][0];
      expectedPromptParts.forEach(part => {
        expect(actualPrompt).toContain(part);
      });
    });

    it('should handle different image styles', async () => {
      const configs = [
        { ...mockConfig, style: 'animated' as const },
        { ...mockConfig, style: 'artistic' as const }
      ];

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      for (const config of configs) {
        const request: CharacterImageRequest = {
          character: mockCharacter,
          config
        };

        await imageGenerator.generateCharacterImage(request);
      }

      expect(mockApiManager.generateImage).toHaveBeenCalledTimes(2);
      
      const prompts = vi.mocked(mockApiManager.generateImage).mock.calls.map(call => call[0]);
      expect(prompts[0]).toContain('animated style, cartoon-like, vibrant colors');
      expect(prompts[1]).toContain('artistic rendering, stylized, creative interpretation');
    });

    it('should handle different quality settings', async () => {
      const qualities: Array<'draft' | 'standard' | 'high'> = ['draft', 'standard', 'high'];
      
      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      for (const quality of qualities) {
        const request: CharacterImageRequest = {
          character: mockCharacter,
          config: { ...mockConfig, quality }
        };

        await imageGenerator.generateCharacterImage(request);
      }

      expect(mockApiManager.generateImage).toHaveBeenCalledTimes(3);
      
      const prompts = vi.mocked(mockApiManager.generateImage).mock.calls.map(call => call[0]);
      expect(prompts[0]).toContain('quick sketch, basic details');
      expect(prompts[1]).toContain('good quality, clear features');
      expect(prompts[2]).toContain('ultra high quality, exceptional detail, masterpiece');
    });

    it('should handle different aspect ratios', async () => {
      const aspectRatios: Array<'1:1' | '16:9' | '4:3'> = ['1:1', '16:9', '4:3'];
      
      vi.mocked(mockApiManager.generateImage).mockImplementation(async () => ({
        ...mockImageResult,
        width: 1024,
        height: aspectRatios.includes('1:1') ? 1024 : aspectRatios.includes('16:9') ? 576 : 768
      }));

      for (const aspectRatio of aspectRatios) {
        const request: CharacterImageRequest = {
          character: mockCharacter,
          config: { ...mockConfig, aspectRatio }
        };

        const result = await imageGenerator.generateCharacterImage(request);
        expect(result.metadata.dimensions.width).toBe(1024);
      }

      expect(mockApiManager.generateImage).toHaveBeenCalledTimes(3);
    });

    it('should reject low quality images', async () => {
      const lowQualityImage: ImageResult = {
        ...mockImageResult,
        size: 100 // Very small file size that will result in quality < 0.6
      };

      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(lowQualityImage);

      await expect(imageGenerator.generateCharacterImage(request)).rejects.toThrow(
        'Generated image quality too low'
      );
    });

    it('should handle API errors', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockRejectedValue(new Error('API Error'));

      await expect(imageGenerator.generateCharacterImage(request)).rejects.toThrow(
        'Failed to generate character image: API Error'
      );
    });
  });

  describe('image validation', () => {
    it('should validate image dimensions correctly', async () => {
      const correctImage: ImageResult = {
        ...mockImageResult,
        width: 1024,
        height: 1024
      };

      const incorrectImage: ImageResult = {
        ...mockImageResult,
        width: 512,
        height: 512
      };

      vi.mocked(mockApiManager.generateImage)
        .mockResolvedValueOnce(correctImage)
        .mockResolvedValueOnce(incorrectImage);

      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      // First call should succeed
      const result1 = await imageGenerator.generateCharacterImage(request);
      expect(result1.metadata.validationResult.isValid).toBe(true);

      // Second call should have validation issues but still succeed (quality > 0.5)
      const result2 = await imageGenerator.generateCharacterImage(request);
      expect(result2.metadata.validationResult.issues).toContain('Incorrect image dimensions');
    });

    it('should validate file size', async () => {
      const smallImage: ImageResult = {
        ...mockImageResult,
        size: 100 // Very small that will result in quality < 0.6
      };

      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(smallImage);

      await expect(imageGenerator.generateCharacterImage(request)).rejects.toThrow();
    });

    it('should validate image format', async () => {
      const invalidFormatImage: ImageResult = {
        ...mockImageResult,
        format: 'bmp'
      };

      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(invalidFormatImage);

      const result = await imageGenerator.generateCharacterImage(request);
      expect(result.metadata.validationResult.issues).toContain('Unsupported image format');
    });
  });

  describe('image storage and retrieval', () => {
    it('should store image metadata correctly', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      await imageGenerator.generateCharacterImage(request);

      // Check that writeFile was called twice: once for image, once for metadata
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      
      // Check the metadata file call (second call)
      const metadataCall = vi.mocked(fs.writeFile).mock.calls[1];
      expect(metadataCall[0]).toContain('John Doe-metadata.json');
      expect(metadataCall[1]).toContain('"characterName": "John Doe"');
    });

    it('should retrieve character image', async () => {
      const mockStoredImage = {
        id: 'john-doe-123456',
        characterName: 'John Doe',
        filePath: './test-images/john-doe-123456.png',
        url: 'https://example.com/image.png',
        metadata: {
          prompt: 'test prompt',
          config: mockConfig,
          validationResult: { isValid: true, quality: 1.0, issues: [], suggestions: [] },
          fileSize: 2048000,
          dimensions: { width: 1024, height: 1024 }
        },
        createdAt: '2025-08-24T20:12:08.225Z' // Use string instead of Date object
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStoredImage));

      const result = await imageGenerator.getCharacterImage('John Doe');

      expect(result).toEqual(mockStoredImage);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('John Doe-metadata.json'),
        'utf-8'
      );
    });

    it('should return null for non-existent character image', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await imageGenerator.getCharacterImage('Non Existent');

      expect(result).toBeNull();
    });

    it('should list all character images', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'john-doe-metadata.json',
        'jane-smith-metadata.json',
        'some-image.png'
      ]);

      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('john-doe')) {
          return JSON.stringify({ characterName: 'John Doe' });
        }
        if (filePath.toString().includes('jane-smith')) {
          return JSON.stringify({ characterName: 'Jane Smith' });
        }
        throw new Error('File not found');
      });

      const result = await imageGenerator.listCharacterImages();

      expect(result).toHaveLength(2);
      expect(result.map(img => img.characterName)).toEqual(['John Doe', 'Jane Smith']);
    });

    it('should delete character image and metadata', async () => {
      const mockStoredImage = {
        id: 'john-doe-123456',
        characterName: 'John Doe',
        filePath: './test-images/john-doe-123456.png',
        url: 'https://example.com/image.png',
        metadata: {} as any,
        createdAt: new Date()
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockStoredImage));

      const result = await imageGenerator.deleteCharacterImage('John Doe');

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith('./test-images/john-doe-123456.png');
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('John Doe-metadata.json')
      );
    });

    it('should update character image', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      // Mock existing image
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        characterName: 'John Doe',
        filePath: './test-images/old-image.png'
      }));

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      const result = await imageGenerator.updateCharacterImage(request);

      expect(result.characterName).toBe('John Doe');
      expect(fs.unlink).toHaveBeenCalled(); // Old image deleted
      expect(mockApiManager.generateImage).toHaveBeenCalled(); // New image generated
    });
  });

  describe('utility methods', () => {
    it('should generate unique image IDs', async () => {
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      const result1 = await imageGenerator.generateCharacterImage(request);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result2 = await imageGenerator.generateCharacterImage(request);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^john-doe-\d+$/);
      expect(result2.id).toMatch(/^john-doe-\d+$/);
    });

    it('should create storage directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(mockApiManager.generateImage).mockResolvedValue(mockImageResult);

      // Create a new instance and trigger directory creation by calling a method
      const newImageGenerator = new ImageGenerator(mockApiManager, './new-test-dir');
      
      const request: CharacterImageRequest = {
        character: mockCharacter,
        config: mockConfig
      };

      await newImageGenerator.generateCharacterImage(request);

      expect(fs.mkdir).toHaveBeenCalledWith('./new-test-dir', { recursive: true });
    });

    it('should handle different resolutions correctly', async () => {
      const resolutions: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      const expectedDimensions = [
        { width: 512, height: 512 },
        { width: 1024, height: 1024 },
        { width: 2048, height: 2048 }
      ];

      for (let i = 0; i < resolutions.length; i++) {
        const request: CharacterImageRequest = {
          character: mockCharacter,
          config: { ...mockConfig, resolution: resolutions[i] }
        };

        // Create a properly sized image result for each resolution
        const imageResult = {
          ...mockImageResult,
          width: expectedDimensions[i].width,
          height: expectedDimensions[i].height,
          size: expectedDimensions[i].width * expectedDimensions[i].height * 0.6 // Ensure it passes validation
        };

        vi.mocked(mockApiManager.generateImage).mockResolvedValueOnce(imageResult);

        const result = await imageGenerator.generateCharacterImage(request);
        expect(result.metadata.dimensions).toEqual(expectedDimensions[i]);
      }
    });
  });
});