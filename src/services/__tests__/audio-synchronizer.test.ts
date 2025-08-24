/**
 * Unit tests for AudioSynchronizer service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSynchronizer, AudioSyncConfig } from '../audio-synchronizer';
import { AudioTrack, Scene, ScriptScene } from '../../types/content';
import { AudioResult } from '../../types/api';

describe('AudioSynchronizer', () => {
  let audioSynchronizer: AudioSynchronizer;
  let config: AudioSyncConfig;

  beforeEach(() => {
    config = {
      maxTimingDifference: 0.5,
      defaultCrossfadeDuration: 1.0,
      maxVolumeAdjustment: 2.0
    };

    audioSynchronizer = new AudioSynchronizer(config);
  });

  describe('synchronizeWithScenes', () => {
    it('should synchronize audio tracks with scene durations', async () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'First scene narration',
          duration: 10.0,
          volume: 0.8
        },
        {
          type: 'music',
          content: 'Background music',
          duration: 10.0,
          volume: 0.3
        }
      ];

      const audioResults: AudioResult[] = [
        {
          url: 'narration-1.mp3',
          format: 'mp3',
          duration: 10.0,
          sampleRate: 44100,
          size: 320000
        },
        {
          url: 'music-1.mp3',
          format: 'mp3',
          duration: 10.0,
          sampleRate: 44100,
          size: 320000
        }
      ];

      const scenes: Scene[] = [
        {
          id: 'scene-1',
          scriptSceneId: 'script-1',
          videoPrompt: 'Scene 1 prompt',
          status: 'completed'
        },
        {
          id: 'scene-2',
          scriptSceneId: 'script-2',
          videoPrompt: 'Scene 2 prompt',
          status: 'completed'
        }
      ];

      const scriptScenes: ScriptScene[] = [
        {
          id: 'script-1',
          description: 'First scene',
          dialogue: ['First dialogue'],
          characters: ['Character 1'],
          visualCues: ['Visual 1'],
          duration: 10.0
        },
        {
          id: 'script-2',
          description: 'Second scene',
          dialogue: ['Second dialogue'],
          characters: ['Character 2'],
          visualCues: ['Visual 2'],
          duration: 10.0
        }
      ];

      // Act
      const result = await audioSynchronizer.synchronizeWithScenes(
        audioTracks,
        audioResults,
        scenes,
        scriptScenes
      );

      // Assert
      expect(result.tracks).toHaveLength(2);
      expect(result.totalDuration).toBe(20.0);
      expect(result.synchronizationReport.totalTracks).toBe(2);
      expect(result.synchronizationReport.adjustedTracks).toBe(0); // No adjustments needed
    });

    it('should adjust tracks when timing difference exceeds threshold', async () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test narration',
          duration: 8.0, // Different from script scene duration
          volume: 0.8
        }
      ];

      const audioResults: AudioResult[] = [
        {
          url: 'narration-1.mp3',
          format: 'mp3',
          duration: 8.0,
          sampleRate: 44100,
          size: 256000
        }
      ];

      const scenes: Scene[] = [
        {
          id: 'scene-1',
          scriptSceneId: 'script-1',
          videoPrompt: 'Scene 1 prompt',
          status: 'completed'
        }
      ];

      const scriptScenes: ScriptScene[] = [
        {
          id: 'script-1',
          description: 'Test scene',
          dialogue: ['Test dialogue'],
          characters: ['Character 1'],
          visualCues: ['Visual 1'],
          duration: 10.0 // Target duration
        }
      ];

      // Act
      const result = await audioSynchronizer.synchronizeWithScenes(
        audioTracks,
        audioResults,
        scenes,
        scriptScenes
      );

      // Assert
      expect(result.synchronizationReport.adjustedTracks).toBe(1);
      expect(result.synchronizationReport.timingIssues).toHaveLength(1);
      expect(result.tracks[0].duration).toBe(10.0); // Adjusted to target duration
      expect(result.tracks[0].adjustmentFactor).toBeCloseTo(1.25, 2); // 10/8 = 1.25
    });

    it('should apply crossfades between adjacent tracks', async () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'First track',
          duration: 5.0,
          volume: 0.8
        },
        {
          type: 'music',
          content: 'Second track',
          duration: 5.0,
          volume: 0.3
        }
      ];

      const audioResults: AudioResult[] = [
        {
          url: 'track-1.mp3',
          format: 'mp3',
          duration: 5.0,
          sampleRate: 44100,
          size: 160000
        },
        {
          url: 'track-2.mp3',
          format: 'mp3',
          duration: 5.0,
          sampleRate: 44100,
          size: 160000
        }
      ];

      const scenes: Scene[] = [
        {
          id: 'scene-1',
          scriptSceneId: 'script-1',
          videoPrompt: 'Scene 1',
          status: 'completed'
        },
        {
          id: 'scene-2',
          scriptSceneId: 'script-2',
          videoPrompt: 'Scene 2',
          status: 'completed'
        }
      ];

      const scriptScenes: ScriptScene[] = [
        {
          id: 'script-1',
          description: 'Scene 1',
          dialogue: ['Dialogue 1'],
          characters: ['Character 1'],
          visualCues: ['Visual 1'],
          duration: 5.0
        },
        {
          id: 'script-2',
          description: 'Scene 2',
          dialogue: ['Dialogue 2'],
          characters: ['Character 2'],
          visualCues: ['Visual 2'],
          duration: 5.0
        }
      ];

      // Act
      const result = await audioSynchronizer.synchronizeWithScenes(
        audioTracks,
        audioResults,
        scenes,
        scriptScenes
      );

      // Assert
      expect(result.synchronizationReport.crossfades).toHaveLength(1);
      expect(result.tracks[0].crossfadeOut).toBeDefined();
      expect(result.tracks[1].crossfadeIn).toBeDefined();
    });

    it('should balance volumes for different track types', async () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Narration',
          duration: 5.0,
          volume: 0.5 // Will be adjusted to 0.8
        },
        {
          type: 'music',
          content: 'Music',
          duration: 5.0,
          volume: 0.8 // Will be adjusted to 0.3
        }
      ];

      const audioResults: AudioResult[] = [
        {
          url: 'narration.mp3',
          format: 'mp3',
          duration: 5.0,
          sampleRate: 44100,
          size: 160000
        },
        {
          url: 'music.mp3',
          format: 'mp3',
          duration: 5.0,
          sampleRate: 44100,
          size: 160000
        }
      ];

      const scenes: Scene[] = [
        {
          id: 'scene-1',
          scriptSceneId: 'script-1',
          videoPrompt: 'Scene 1',
          status: 'completed'
        },
        {
          id: 'scene-2',
          scriptSceneId: 'script-2',
          videoPrompt: 'Scene 2',
          status: 'completed'
        }
      ];

      const scriptScenes: ScriptScene[] = [
        {
          id: 'script-1',
          description: 'Scene 1',
          dialogue: ['Dialogue 1'],
          characters: ['Character 1'],
          visualCues: ['Visual 1'],
          duration: 5.0
        },
        {
          id: 'script-2',
          description: 'Scene 2',
          dialogue: ['Dialogue 2'],
          characters: ['Character 2'],
          visualCues: ['Visual 2'],
          duration: 5.0
        }
      ];

      // Act
      const result = await audioSynchronizer.synchronizeWithScenes(
        audioTracks,
        audioResults,
        scenes,
        scriptScenes
      );

      // Assert
      expect(result.synchronizationReport.volumeAdjustments.length).toBeGreaterThan(0);
      expect(result.tracks[0].volume).toBe(0.8); // Narration target volume (no change needed)
      expect(result.tracks[1].volume).toBe(0.4); // Music volume (limited by maxVolumeAdjustment: 0.8/2.0 = 0.4)
    });

    it('should throw error for mismatched array lengths', async () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test',
          duration: 5.0,
          volume: 0.8
        }
      ];

      const audioResults: AudioResult[] = []; // Empty array

      const scenes: Scene[] = [];
      const scriptScenes: ScriptScene[] = [];

      // Act & Assert
      await expect(
        audioSynchronizer.synchronizeWithScenes(audioTracks, audioResults, scenes, scriptScenes)
      ).rejects.toThrow('Audio tracks and results arrays must have the same length');
    });
  });

  describe('mixAudioTracks', () => {
    it('should mix multiple audio tracks', async () => {
      // Arrange
      const tracks = [
        {
          type: 'narration' as const,
          content: 'Narration',
          duration: 5.0,
          volume: 0.8,
          startTime: 0,
          endTime: 5.0,
          originalDuration: 5.0,
          adjustmentFactor: 1.0
        },
        {
          type: 'music' as const,
          content: 'Music',
          duration: 5.0,
          volume: 0.3,
          startTime: 5.0,
          endTime: 10.0,
          originalDuration: 5.0,
          adjustmentFactor: 1.0
        }
      ];

      // Act
      const result = await audioSynchronizer.mixAudioTracks(tracks);

      // Assert
      expect(result).toMatch(/^mixed-\d+\.mp3$/);
    });
  });

  describe('validateSynchronization', () => {
    it('should validate correct synchronization setup', () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test',
          duration: 5.0,
          volume: 0.8
        }
      ];

      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Test scene',
          dialogue: ['Test'],
          characters: ['Character'],
          visualCues: ['Visual'],
          duration: 5.0
        }
      ];

      // Act
      const result = audioSynchronizer.validateSynchronization(audioTracks, scenes);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect mismatched track and scene counts', () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test',
          duration: 5.0,
          volume: 0.8
        }
      ];

      const scenes: ScriptScene[] = []; // Empty array

      // Act
      const result = audioSynchronizer.validateSynchronization(audioTracks, scenes);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Mismatch between audio tracks (1) and scenes (0)');
    });

    it('should detect invalid track durations', () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test',
          duration: -1.0, // Invalid duration
          volume: 0.8
        }
      ];

      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Test scene',
          dialogue: ['Test'],
          characters: ['Character'],
          visualCues: ['Visual'],
          duration: 5.0
        }
      ];

      // Act
      const result = audioSynchronizer.validateSynchronization(audioTracks, scenes);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Track 0 has invalid duration: -1');
    });

    it('should detect invalid volume levels', () => {
      // Arrange
      const audioTracks: AudioTrack[] = [
        {
          type: 'narration',
          content: 'Test',
          duration: 5.0,
          volume: 1.5 // Invalid volume > 1
        }
      ];

      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Test scene',
          dialogue: ['Test'],
          characters: ['Character'],
          visualCues: ['Visual'],
          duration: 5.0
        }
      ];

      // Act
      const result = audioSynchronizer.validateSynchronization(audioTracks, scenes);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Track 0 has invalid volume: 1.5');
    });
  });

  describe('calculateTotalDuration', () => {
    it('should calculate total duration from scenes', () => {
      // Arrange
      const scenes: ScriptScene[] = [
        {
          id: 'scene-1',
          description: 'Scene 1',
          dialogue: ['Dialogue 1'],
          characters: ['Character 1'],
          visualCues: ['Visual 1'],
          duration: 5.0
        },
        {
          id: 'scene-2',
          description: 'Scene 2',
          dialogue: ['Dialogue 2'],
          characters: ['Character 2'],
          visualCues: ['Visual 2'],
          duration: 7.0
        }
      ];

      // Act
      const totalDuration = audioSynchronizer.calculateTotalDuration(scenes);

      // Assert
      expect(totalDuration).toBe(12.0);
    });

    it('should return 0 for empty scenes array', () => {
      // Act
      const totalDuration = audioSynchronizer.calculateTotalDuration([]);

      // Assert
      expect(totalDuration).toBe(0);
    });
  });

  describe('generateReportSummary', () => {
    it('should generate comprehensive report summary', () => {
      // Arrange
      const report = {
        totalTracks: 3,
        adjustedTracks: 2,
        timingIssues: [
          {
            trackIndex: 0,
            trackType: 'narration',
            expectedDuration: 10.0,
            actualDuration: 8.0,
            adjustment: 'Speed adjusted by factor 1.250'
          }
        ],
        volumeAdjustments: [
          {
            trackIndex: 1,
            trackType: 'music',
            originalVolume: 0.8,
            adjustedVolume: 0.3,
            reason: 'Balanced for music track type'
          }
        ],
        crossfades: [
          {
            fromTrack: 0,
            toTrack: 1,
            duration: 1.0,
            startTime: 5.0
          }
        ]
      };

      // Act
      const summary = audioSynchronizer.generateReportSummary(report);

      // Assert
      expect(summary).toContain('Audio Synchronization Report');
      expect(summary).toContain('Total tracks processed: 3');
      expect(summary).toContain('Tracks requiring adjustment: 2');
      expect(summary).toContain('Timing Adjustments:');
      expect(summary).toContain('Volume Adjustments:');
      expect(summary).toContain('narration: Speed adjusted by factor 1.250');
      expect(summary).toContain('music: 0.80 → 0.30');
    });
  });
});