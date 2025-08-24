/**
 * Unit tests for ImageToVideoGenerator service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageToVideoGenerator, ImageToVideoConfig } from '../image-to-video-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { CharacterDatabaseManager } from '../../managers/character-database-manager';
import { ImageGenerator } from '../image-generator';
import { ScriptScene, Character } from '../../types/content';
import { VideoResult, ImageResult } from '../../types/api';

// Mock dependencies
vi.mock('../../api/gemini-api-manager');
vi.mock('../../managers/character-database-manager');
vi.mock('../image-generator');

describe('ImageToVideoGenerator', () => {
  let imageToVideoGenerator: ImageToVideoGenerator;
  let mockApiManager: vi.Mocked<GeminiAPIManager>;
  let mockCharacterManager: vi.Mocked<CharacterDatabaseManager>;
  let mockImageGenerator: vi.Mocked<ImageGenerator>;
  let config: ImageToVideoConfig;

  beforeEach(() => {
    // Create mocked instances
    mockApiManager = {
      generateVideo: vi.fn(),
      generateText: vi.fn(),
      generateImage: vi.fn(),
      generateAudio: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    mockCharacterManager = {
      generateCharacterPrompt: vi.fn(),
      addCharacter: vi.fn(),
      getCharacterDescription: vi.fn(),
      hasCharacter: vi.fn(),
      getAllCharacters: vi.fn().mockReturnValue([]),
      setCharacterReferenceImage: vi.fn()
    } as any;

    mockImageGenerator = {
      generateCharacterReference: vi.fn(),
      generateSceneReference: vi.fn(),
      generateCharacterImage: vi.fn(),
      getCharacterImage: vi.fn(),
      listCharacterImages: vi.fn(),
      deleteCharacterImage: vi.fn(),
      updateCharacterImage: vi.fn()
    } as any;

    // Set up default mock returns
    const mockImageResult: ImageResult = {
      url: 'default-image.jpg',
      format: 'jpg',
      width: 1024,
      height: 1024,
      size: 2048000
    };
    
    mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
    mockImageGenerator.generateSceneReference.mockResolvedValue(mockImageResult);

    config = {
      maxScenes: 2,
      quality: 'standard',
      aspectRatio: '16:9',
      duration: 5,
      generateReferenceImages: true,
      reuseCharacterImages: true
    };

    imageToVideoGenerator = new ImageToVideoGenerator(
      mockApiManager,
      mockCharacterManager,
      mockImageGenerator,
      config
    );
  });

  describe('generateVideosFromScript', () => {
    it('should generate videos using reference images', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Character walks into room',
          dialogue: ['Hello there'],
          characters: ['John'],
          visualCues: ['medium shot'],
          duration: 5
        },
        {
          id: 'scene-2',
          description: 'Character sits down',
          dialogue: ['How are you?'],
          characters: ['John'],
          visualCues: ['close-up'],
          duration: 4
        }
      ];

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Tall man with brown hair');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await imageToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.totalScenes).toBe(2);
      expect(result.completed).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockApiManager.generateVideo).toHaveBeenCalledTimes(2);
      expect(mockImageGenerator.generateCharacterReference).toHaveBeenCalled();
    });

    it('should generate reference images when configured', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Test scene',
          dialogue: [],
          characters: ['John', 'Mary'],
          visualCues: [],
          duration: 5
        }
      ];

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      await imageToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(mockImageGenerator.generateCharacterReference).toHaveBeenCalledWith(
        expect.stringContaining('Character reference image for John')
      );
      expect(mockImageGenerator.generateCharacterReference).toHaveBeenCalledWith(
        expect.stringContaining('Character reference image for Mary')
      );
    });

    it('should handle video generation failures gracefully', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Test scene',
          dialogue: [],
          characters: ['John'],
          visualCues: [],
          duration: 5
        }
      ];

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await imageToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.completed).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].status).toBe('failed');
    });

    it('should enforce scene limit', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = Array.from({ length: 5 }, (_, i) => ({
        id: `scene-${i + 1}`,
        description: `Scene ${i + 1}`,
        dialogue: [],
        characters: ['John'],
        visualCues: [],
        duration: 5
      }));

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await imageToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.totalScenes).toBe(2); // Should respect maxScenes config (2)
      expect(mockApiManager.generateVideo).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateVideoFromImage', () => {
    it('should generate video with reference image', async () => {
      // Arrange
      const scene = {
        id: 'test-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Character walks into room',
        status: 'pending' as const
      };

      const referenceImage = 'character-reference.jpg';
      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await imageToVideoGenerator.generateVideoFromImage(scene, referenceImage);

      // Assert
      expect(result).toEqual(mockVideoResult);
      expect(mockApiManager.generateVideo).toHaveBeenCalledWith(
        expect.stringContaining('Animate this image'),
        referenceImage,
        'gemini-2.0-flash-exp'
      );
    });
  });

  describe('character image caching', () => {
    it('should cache character images for reuse', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: [],
          characters: ['John'],
          visualCues: [],
          duration: 5
        },
        {
          id: 'scene-2',
          description: 'Scene 2',
          dialogue: [],
          characters: ['John'], // Same character
          visualCues: [],
          duration: 5
        }
      ];

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      await imageToVideoGenerator.generateVideosFromScript(scriptScenes);
      const cache = imageToVideoGenerator.getCharacterImageCache();

      // Assert
      expect(cache).toHaveLength(1);
      expect(cache[0].characterName).toBe('john'); // Normalized name
      expect(cache[0].sceneIds).toContain('img-video-scene-1');
      expect(cache[0].sceneIds).toContain('img-video-scene-2');
    });

    it('should reuse cached images when configured', async () => {
      // Arrange
      config.reuseCharacterImages = true;
      
      // Use the same instance to test cache reuse
      const imageToVideoGeneratorWithReuse = imageToVideoGenerator;

      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: [],
          characters: ['John'],
          visualCues: [],
          duration: 5
        }
      ];

      const mockImageResult: ImageResult = {
        url: 'character-reference.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue(mockImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // First generation to populate cache
      await imageToVideoGeneratorWithReuse.generateVideosFromScript(scriptScenes);
      
      // Verify cache was populated
      const cacheAfterFirst = imageToVideoGeneratorWithReuse.getCharacterImageCache();
      expect(cacheAfterFirst).toHaveLength(1);
      
      // Reset mock call counts
      mockImageGenerator.generateCharacterReference.mockClear();

      // Act - Second generation should reuse cache
      await imageToVideoGeneratorWithReuse.generateVideosFromScript(scriptScenes);

      // Assert
      expect(mockImageGenerator.generateCharacterReference).not.toHaveBeenCalled();
    });

    it('should clear character image cache', () => {
      // Arrange - Add some cached images first
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: [],
          characters: ['John'],
          visualCues: [],
          duration: 5
        }
      ];

      // Act
      imageToVideoGenerator.clearCharacterImageCache();
      const cache = imageToVideoGenerator.getCharacterImageCache();

      // Assert
      expect(cache).toHaveLength(0);
    });
  });

  describe('prompt engineering for image-to-video', () => {
    it('should include motion descriptions in prompts', async () => {
      // Arrange
      const scene = {
        id: 'test-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Character walks into room',
        status: 'pending' as const
      };

      const referenceImage = 'character-reference.jpg';
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await imageToVideoGenerator.generateVideoFromImage(scene, referenceImage);

      // Assert
      const capturedPrompt = mockApiManager.generateVideo.mock.calls[0][0];
      expect(capturedPrompt).toContain('Animate this image');
      expect(capturedPrompt).toContain('Duration: 5 seconds');
      expect(capturedPrompt).toContain('Quality: Standard HD quality');
    });

    it('should adapt motion based on scene content', async () => {
      // Arrange
      const walkingScene = {
        id: 'walking-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Character walks down the street',
        status: 'pending' as const
      };

      // Mock the findScriptScene to return a scene with walking description
      const originalFindScriptScene = (imageToVideoGenerator as any).findScriptScene;
      (imageToVideoGenerator as any).findScriptScene = vi.fn().mockReturnValue({
        id: 'script-scene-1',
        description: 'Character walks down the street',
        dialogue: [],
        characters: [],
        visualCues: [],
        duration: 5
      });

      const referenceImage = 'character-reference.jpg';
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await imageToVideoGenerator.generateVideoFromImage(walkingScene, referenceImage);

      // Assert
      const capturedPrompt = mockApiManager.generateVideo.mock.calls[0][0];
      expect(capturedPrompt).toContain('Character walking or moving through the scene');
    });
  });

  describe('scene reference images', () => {
    it('should generate scene reference when no characters present', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Empty landscape scene',
          dialogue: [],
          characters: [], // No characters
          visualCues: ['wide shot', 'sunset'],
          duration: 5
        }
      ];

      // Mock the findScriptScene to return the actual scene data
      const originalFindScriptScene = (imageToVideoGenerator as any).findScriptScene;
      (imageToVideoGenerator as any).findScriptScene = vi.fn().mockReturnValue(scriptScenes[0]);

      const mockSceneImageResult: ImageResult = {
        url: 'scene-reference.jpg',
        format: 'jpg',
        width: 1920,
        height: 1080,
        size: 3072000
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockImageGenerator.generateSceneReference.mockResolvedValue(mockSceneImageResult);
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await imageToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.completed).toHaveLength(1);
      expect(mockImageGenerator.generateSceneReference).toHaveBeenCalledWith(
        expect.stringContaining('Empty landscape scene')
      );
    });
  });

  describe('progress tracking', () => {
    it('should track generation progress correctly', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        { id: 'scene-1', description: 'Scene 1', dialogue: [], characters: ['John'], visualCues: [], duration: 5 }
      ];

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue({
        url: 'ref.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      });
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await imageToVideoGenerator.generateVideosFromScript(scriptScenes);
      const progress = imageToVideoGenerator.getProgress();

      // Assert
      expect(progress.completed).toBe(1);
      expect(progress.total).toBe(1);
      expect(progress.percentage).toBe(100);
    });

    it('should return queue status with character images', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        { id: 'scene-1', description: 'Scene 1', dialogue: [], characters: ['John'], visualCues: [], duration: 5 }
      ];

      mockCharacterManager.hasCharacter.mockReturnValue(true);
      mockCharacterManager.getCharacterDescription.mockReturnValue('Character description');
      mockImageGenerator.generateCharacterReference.mockResolvedValue({
        url: 'ref.jpg',
        format: 'jpg',
        width: 1024,
        height: 1024,
        size: 2048000
      });
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await imageToVideoGenerator.generateVideosFromScript(scriptScenes);
      const queueStatus = imageToVideoGenerator.getQueueStatus();

      // Assert
      expect(queueStatus.totalScenes).toBe(1);
      expect(queueStatus.completed).toHaveLength(1);
      expect(queueStatus.characterImages).toHaveLength(1);
    });
  });
});