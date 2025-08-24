/**
 * Unit tests for AudioGenerator service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioGenerator, AudioGeneratorConfig, NarrationOptions } from '../audio-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { AudioResult, VoiceConfig } from '../../types/api';
import { ScriptScene } from '../../types/content';

// Mock the GeminiAPIManager
vi.mock('../../api/gemini-api-manager');

describe('AudioGenerator', () => {
  let audioGenerator: AudioGenerator;
  let mockApiManager: vi.Mocked<GeminiAPIManager>;
  let config: AudioGeneratorConfig;

  beforeEach(() => {
    // Create mock API manager
    mockApiManager = {
      generateAudio: vi.fn(),
      generateText: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    // Default configuration
    config = {
      defaultVoice: 'en-US-Standard-A',
      defaultSpeed: 1.0,
      defaultPitch: 0.0,
      defaultVolume: 0.8,
      maxTextLength: 5000
    };

    audioGenerator = new AudioGenerator(mockApiManager, config);
  });

  describe('generateNarration', () => {
    it('should generate narration from dialogue array', async () => {
      // Arrange
      const dialogue = ['Hello world', 'This is a test'];
      const expectedText = 'Hello world This is a test';
      const mockAudioResult: AudioResult = {
        url: 'test-audio.mp3',
        format: 'mp3',
        duration: 5.0,
        sampleRate: 44100,
        size: 128000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await audioGenerator.generateNarration(dialogue);

      // Assert
      expect(mockApiManager.generateAudio).toHaveBeenCalledWith(
        expectedText,
        expect.objectContaining({
          voice: config.defaultVoice,
          speed: config.defaultSpeed,
          pitch: config.defaultPitch,
          volume: config.defaultVolume
        })
      );

      expect(result.audioTrack).toEqual({
        type: 'narration',
        content: expectedText,
        duration: 5.0,
        volume: config.defaultVolume
      });

      expect(result.audioResult).toBe(mockAudioResult);
      expect(result.syncedDuration).toBe(5.0);
      expect(result.adjustmentsMade).toBe(false);
    });

    it('should use custom narration options', async () => {
      // Arrange
      const dialogue = ['Test dialogue'];
      const options: NarrationOptions = {
        voice: 'en-US-Wavenet-A',
        speed: 1.2,
        pitch: 0.5,
        volume: 0.9
      };

      const mockAudioResult: AudioResult = {
        url: 'test-audio.mp3',
        format: 'mp3',
        duration: 3.0,
        sampleRate: 44100,
        size: 96000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await audioGenerator.generateNarration(dialogue, options);

      // Assert
      expect(mockApiManager.generateAudio).toHaveBeenCalledWith(
        'Test dialogue',
        expect.objectContaining({
          voice: options.voice,
          speed: options.speed,
          pitch: options.pitch,
          volume: options.volume
        })
      );

      expect(result.audioTrack.volume).toBe(options.volume);
    });

    it('should throw error for text exceeding maximum length', async () => {
      // Arrange
      const longText = 'a'.repeat(config.maxTextLength + 1);
      const dialogue = [longText];

      // Act & Assert
      await expect(audioGenerator.generateNarration(dialogue)).rejects.toThrow(
        `Narration text exceeds maximum length of ${config.maxTextLength} characters`
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const dialogue = ['Test dialogue'];
      mockApiManager.generateAudio.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(audioGenerator.generateNarration(dialogue)).rejects.toThrow(
        'Failed to generate narration: API Error'
      );
    });
  });

  describe('generateSceneNarration', () => {
    it('should generate narration for a scene', async () => {
      // Arrange
      const scene: ScriptScene = {
        id: 'scene-1',
        description: 'Test scene',
        dialogue: ['Scene dialogue'],
        characters: ['Character 1'],
        visualCues: ['Visual cue'],
        duration: 10.0
      };

      const mockAudioResult: AudioResult = {
        url: 'scene-audio.mp3',
        format: 'mp3',
        duration: 10.0,
        sampleRate: 44100,
        size: 256000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await audioGenerator.generateSceneNarration(scene);

      // Assert
      expect(result.audioTrack.content).toBe('Scene dialogue');
      expect(result.syncedDuration).toBe(10.0);
      expect(result.adjustmentsMade).toBe(false);
    });

    it('should synchronize audio to target duration', async () => {
      // Arrange
      const scene: ScriptScene = {
        id: 'scene-1',
        description: 'Test scene',
        dialogue: ['Scene dialogue'],
        characters: ['Character 1'],
        visualCues: ['Visual cue'],
        duration: 10.0
      };

      const mockAudioResult: AudioResult = {
        url: 'scene-audio.mp3',
        format: 'mp3',
        duration: 8.0, // Different from target duration
        sampleRate: 44100,
        size: 256000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await audioGenerator.generateSceneNarration(scene, 10.0);

      // Assert
      expect(result.syncedDuration).toBe(10.0);
      expect(result.adjustmentsMade).toBe(true);
    });
  });

  describe('generateMultipleNarrations', () => {
    it('should generate narrations for multiple scenes', async () => {
      // Arrange
      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: ['Dialogue 1'],
          characters: ['Character 1'],
          visualCues: ['Cue 1'],
          duration: 5.0
        },
        {
          id: 'scene-2',
          description: 'Scene 2',
          dialogue: ['Dialogue 2'],
          characters: ['Character 2'],
          visualCues: ['Cue 2'],
          duration: 7.0
        }
      ];

      const mockAudioResults: AudioResult[] = [
        {
          url: 'audio-1.mp3',
          format: 'mp3',
          duration: 5.0,
          sampleRate: 44100,
          size: 128000
        },
        {
          url: 'audio-2.mp3',
          format: 'mp3',
          duration: 7.0,
          sampleRate: 44100,
          size: 179200
        }
      ];

      mockApiManager.generateAudio
        .mockResolvedValueOnce(mockAudioResults[0])
        .mockResolvedValueOnce(mockAudioResults[1]);

      // Act
      const results = await audioGenerator.generateMultipleNarrations(scenes);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].audioTrack.content).toBe('Dialogue 1');
      expect(results[1].audioTrack.content).toBe('Dialogue 2');
      expect(mockApiManager.generateAudio).toHaveBeenCalledTimes(2);
    });

    it('should create fallback silent tracks for failed generations', async () => {
      // Arrange
      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: ['Dialogue 1'],
          characters: ['Character 1'],
          visualCues: ['Cue 1'],
          duration: 5.0
        }
      ];

      mockApiManager.generateAudio.mockRejectedValue(new Error('API Error'));

      // Act
      const results = await audioGenerator.generateMultipleNarrations(scenes);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].audioTrack.content).toBe('');
      expect(results[0].audioTrack.volume).toBe(0);
      expect(results[0].adjustmentsMade).toBe(true);
    });
  });

  describe('estimateNarrationDuration', () => {
    it('should estimate duration based on text length and speed', () => {
      // Arrange
      const text = 'This is a test sentence with eight words.'; // 8 words
      const speed = 1.0;

      // Act
      const duration = audioGenerator.estimateNarrationDuration(text, speed);

      // Assert
      // 8 words at 155 words per minute = 8/155 * 60 ≈ 3.10 seconds
      expect(duration).toBeCloseTo(3.10, 1);
    });

    it('should adjust duration for different speeds', () => {
      // Arrange
      const text = 'This is a test sentence with eight words.';
      const normalSpeed = 1.0;
      const fastSpeed = 2.0;

      // Act
      const normalDuration = audioGenerator.estimateNarrationDuration(text, normalSpeed);
      const fastDuration = audioGenerator.estimateNarrationDuration(text, fastSpeed);

      // Assert
      expect(fastDuration).toBeCloseTo(normalDuration / 2, 1);
    });
  });

  describe('validateNarrationText', () => {
    it('should validate normal text as valid', () => {
      // Arrange
      const text = 'This is a normal sentence with punctuation!';

      // Act
      const result = audioGenerator.validateNarrationText(text);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect text that exceeds maximum length', () => {
      // Arrange
      const text = 'a'.repeat(config.maxTextLength + 1);

      // Act
      const result = audioGenerator.validateNarrationText(text);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        `Text exceeds maximum length of ${config.maxTextLength} characters`
      );
    });

    it('should detect empty text', () => {
      // Arrange
      const text = '   ';

      // Act
      const result = audioGenerator.validateNarrationText(text);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Text cannot be empty');
    });

    it('should detect unsupported characters', () => {
      // Arrange
      const text = 'Text with emoji 😀 and symbols ©';

      // Act
      const result = audioGenerator.validateNarrationText(text);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('Contains potentially unsupported characters');
    });
  });

  describe('getSupportedVoices', () => {
    it('should return list of supported voices', () => {
      // Act
      const voices = audioGenerator.getSupportedVoices();

      // Assert
      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices).toContain('en-US-Standard-A');
      expect(voices).toContain('en-US-Wavenet-A');
    });
  });
});