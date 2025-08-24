/**
 * Unit tests for TextToVideoGenerator service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextToVideoGenerator, VideoGenerationConfig } from '../text-to-video-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { CharacterDatabaseManager } from '../../managers/character-database-manager';
import { ScriptScene } from '../../types/content';
import { VideoResult } from '../../types/api';

// Mock dependencies
vi.mock('../../api/gemini-api-manager');
vi.mock('../../managers/character-database-manager');

describe('TextToVideoGenerator', () => {
  let textToVideoGenerator: TextToVideoGenerator;
  let mockApiManager: vi.Mocked<GeminiAPIManager>;
  let mockCharacterManager: vi.Mocked<CharacterDatabaseManager>;
  let config: VideoGenerationConfig;

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
      getAllCharacters: vi.fn()
    } as any;

    config = {
      maxScenes: 3,
      quality: 'standard',
      aspectRatio: '16:9',
      duration: 5
    };

    textToVideoGenerator = new TextToVideoGenerator(
      mockApiManager,
      mockCharacterManager,
      config
    );
  });

  describe('generateVideosFromScript', () => {
    it('should generate videos for script scenes within scene limit', async () => {
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
          characters: ['John', 'Mary'],
          visualCues: ['close-up'],
          duration: 4
        },
        {
          id: 'scene-3',
          description: 'Characters talk',
          dialogue: ['Fine, thanks'],
          characters: ['Mary'],
          visualCues: ['wide shot'],
          duration: 6
        },
        {
          id: 'scene-4',
          description: 'Extra scene beyond limit',
          dialogue: [],
          characters: [],
          visualCues: [],
          duration: 3
        }
      ];

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue(
        'Character descriptions for consistency: John: tall man with brown hair; Mary: young woman with blonde hair. Maintain these character appearances throughout the scene. '
      );
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await textToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.totalScenes).toBe(3); // Should respect maxScenes limit
      expect(result.completed).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(mockApiManager.generateVideo).toHaveBeenCalledTimes(3);
      
      // Verify character prompt generation was called for each scene
      expect(mockCharacterManager.generateCharacterPrompt).toHaveBeenCalledTimes(3);
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

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Character prompt');
      mockApiManager.generateVideo.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await textToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.completed).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].status).toBe('failed');
    });

    it('should start from specified index', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        { id: 'scene-1', description: 'Scene 1', dialogue: [], characters: [], visualCues: [], duration: 5 },
        { id: 'scene-2', description: 'Scene 2', dialogue: [], characters: [], visualCues: [], duration: 5 },
        { id: 'scene-3', description: 'Scene 3', dialogue: [], characters: [], visualCues: [], duration: 5 }
      ];

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Character prompt');
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act - Start from index 1
      const result = await textToVideoGenerator.generateVideosFromScript(scriptScenes, 1);

      // Assert
      expect(result.totalScenes).toBe(2); // Should process scenes 1 and 2 (indices 1-2)
      expect(result.scenes[0].scriptSceneId).toBe('scene-2');
      expect(result.scenes[1].scriptSceneId).toBe('scene-3');
    });
  });

  describe('generateSingleVideo', () => {
    it('should generate video with engineered prompt', async () => {
      // Arrange
      const scene = {
        id: 'test-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Character walks into room',
        status: 'pending' as const
      };

      const mockVideoResult: VideoResult = {
        url: 'generated-video.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 10485760
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue(
        'Character descriptions for consistency: John: tall man. Maintain these character appearances throughout the scene. Character walks into room'
      );
      mockApiManager.generateVideo.mockResolvedValue(mockVideoResult);

      // Act
      const result = await textToVideoGenerator.generateSingleVideo(scene);

      // Assert
      expect(result).toEqual(mockVideoResult);
      expect(mockApiManager.generateVideo).toHaveBeenCalledWith(
        expect.stringContaining('Character descriptions for consistency'),
        undefined, // No reference image for text-to-video
        'gemini-2.0-flash-exp'
      );
    });
  });

  describe('prompt engineering', () => {
    it('should include character descriptions in video prompt', async () => {
      // Arrange
      const scene = {
        id: 'test-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Test scene',
        status: 'pending' as const
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue(
        'Character descriptions for consistency: John: tall man with brown hair. Maintain these character appearances throughout the scene. Test scene'
      );
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await textToVideoGenerator.generateSingleVideo(scene);

      // Assert
      expect(mockCharacterManager.generateCharacterPrompt).toHaveBeenCalledWith(
        [], // Empty characters array from placeholder script scene
        'Test scene',
        {
          includeAppearances: true,
          maxDescriptionLength: 150,
          prioritizeMainCharacters: true
        }
      );
    });

    it('should include technical specifications in prompt', async () => {
      // Arrange
      const scene = {
        id: 'test-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Test scene',
        status: 'pending' as const
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Enhanced prompt');
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await textToVideoGenerator.generateSingleVideo(scene);

      // Assert
      const capturedPrompt = mockApiManager.generateVideo.mock.calls[0][0];
      expect(capturedPrompt).toContain('Quality: Standard HD quality');
      expect(capturedPrompt).toContain('Aspect ratio: 16:9');
      expect(capturedPrompt).toContain('Scene duration: 5 seconds');
    });
  });

  describe('progress tracking', () => {
    it('should track generation progress correctly', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        { id: 'scene-1', description: 'Scene 1', dialogue: [], characters: [], visualCues: [], duration: 5 },
        { id: 'scene-2', description: 'Scene 2', dialogue: [], characters: [], visualCues: [], duration: 5 }
      ];

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Character prompt');
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await textToVideoGenerator.generateVideosFromScript(scriptScenes);
      const progress = textToVideoGenerator.getProgress();

      // Assert
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(2);
      expect(progress.percentage).toBe(100);
    });

    it('should return queue status', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = [
        { id: 'scene-1', description: 'Scene 1', dialogue: [], characters: [], visualCues: [], duration: 5 }
      ];

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Character prompt');
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await textToVideoGenerator.generateVideosFromScript(scriptScenes);
      const queueStatus = textToVideoGenerator.getQueueStatus();

      // Assert
      expect(queueStatus.totalScenes).toBe(1);
      expect(queueStatus.completed).toHaveLength(1);
      expect(queueStatus.failed).toHaveLength(0);
      expect(queueStatus.scenes).toHaveLength(1);
    });
  });

  describe('scene limit enforcement', () => {
    it('should enforce maximum scene limit', async () => {
      // Arrange
      const scriptScenes: ScriptScene[] = Array.from({ length: 10 }, (_, i) => ({
        id: `scene-${i + 1}`,
        description: `Scene ${i + 1}`,
        dialogue: [],
        characters: [],
        visualCues: [],
        duration: 5
      }));

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Character prompt');
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      const result = await textToVideoGenerator.generateVideosFromScript(scriptScenes);

      // Assert
      expect(result.totalScenes).toBe(3); // Should respect maxScenes config (3)
      expect(mockApiManager.generateVideo).toHaveBeenCalledTimes(3);
    });
  });

  describe('visual style engineering', () => {
    it('should adapt visual style based on scene content', async () => {
      // Arrange
      const scene = {
        id: 'outdoor-scene',
        scriptSceneId: 'script-scene-1',
        videoPrompt: 'Character walks outdoor in nature',
        status: 'pending' as const
      };

      mockCharacterManager.generateCharacterPrompt.mockReturnValue('Enhanced prompt with outdoor scene');
      mockApiManager.generateVideo.mockResolvedValue({
        url: 'test.mp4',
        format: 'mp4',
        duration: 5,
        width: 1920,
        height: 1080,
        size: 1000000
      });

      // Act
      await textToVideoGenerator.generateSingleVideo(scene);

      // Assert
      const capturedPrompt = mockApiManager.generateVideo.mock.calls[0][0];
      expect(capturedPrompt).toContain('Cinematic style with professional lighting');
    });
  });
});