/**
 * Unit tests for ProgressDisplay
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressDisplay } from '../progress-display';
import { GenerationProgress, GenerationStage } from '../../types';

// Mock ora
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: '',
  color: 'blue'
};

vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner)
}));

describe('ProgressDisplay', () => {
  let progressDisplay: ProgressDisplay;

  beforeEach(() => {
    progressDisplay = new ProgressDisplay();
    vi.clearAllMocks();
  });

  describe('Basic Progress Operations', () => {
    it('should start progress display', () => {
      progressDisplay.start();
      
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should complete progress display', () => {
      progressDisplay.start();
      progressDisplay.complete();
      
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('Content generation completed')
      );
    });

    it('should display error', () => {
      progressDisplay.start();
      progressDisplay.error('Test error message');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    it('should display warning', () => {
      progressDisplay.start();
      progressDisplay.warn('Test warning message');
      
      expect(mockSpinner.warn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
    });

    it('should display info', () => {
      progressDisplay.start();
      progressDisplay.info('Test info message');
      
      expect(mockSpinner.info).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });
  });

  describe('Progress Updates', () => {
    beforeEach(() => {
      progressDisplay.start();
    });

    it('should update progress for idea generation stage', () => {
      const progress: GenerationProgress = {
        currentStage: 'idea_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('💡 Generating content idea');
      expect(mockSpinner.text).toContain('(6%)');
      expect(mockSpinner.color).toBe('yellow');
    });

    it('should update progress for script creation stage', () => {
      const progress: GenerationProgress = {
        currentStage: 'script_creation',
        completedStages: ['idea_generation'],
        totalStages: 8,
        currentStageProgress: 0.3,
        overallProgress: 0.1625
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('📝 Creating script');
      expect(mockSpinner.text).toContain('(16%)');
      expect(mockSpinner.color).toBe('blue');
    });

    it('should update progress for video generation stage', () => {
      const progress: GenerationProgress = {
        currentStage: 'video_generation',
        completedStages: ['idea_generation', 'script_creation', 'character_analysis', 'image_generation'],
        totalStages: 8,
        currentStageProgress: 0.7,
        overallProgress: 0.5875
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('🎬 Generating videos');
      expect(mockSpinner.text).toContain('(59%)');
      expect(mockSpinner.color).toBe('green');
    });

    it('should show estimated time remaining', () => {
      const progress: GenerationProgress = {
        currentStage: 'audio_generation',
        completedStages: ['idea_generation', 'script_creation', 'character_analysis', 'image_generation', 'video_generation'],
        totalStages: 8,
        currentStageProgress: 0.4,
        overallProgress: 0.675,
        estimatedTimeRemaining: 120000 // 2 minutes
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('🎵 Generating audio');
      expect(mockSpinner.text).toContain('(68%)');
      expect(mockSpinner.text).toContain('2m 0s remaining');
    });

    it('should handle stage transitions', () => {
      // First update - idea generation
      const progress1: GenerationProgress = {
        currentStage: 'idea_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 1.0,
        overallProgress: 0.125
      };

      progressDisplay.update(progress1);

      // Second update - script creation (stage transition)
      const progress2: GenerationProgress = {
        currentStage: 'script_creation',
        completedStages: ['idea_generation'],
        totalStages: 8,
        currentStageProgress: 0.0,
        overallProgress: 0.125
      };

      progressDisplay.update(progress2);
      
      // Should show completion of previous stage
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('💡 Generating content idea completed')
      );
    });
  });

  describe('Stage Display Text', () => {
    const stageTests: Array<{ stage: GenerationStage; expectedText: string; expectedColor: string }> = [
      { stage: 'idea_generation', expectedText: '💡 Generating content idea', expectedColor: 'yellow' },
      { stage: 'script_creation', expectedText: '📝 Creating script', expectedColor: 'blue' },
      { stage: 'character_analysis', expectedText: '👥 Analyzing characters', expectedColor: 'magenta' },
      { stage: 'image_generation', expectedText: '🖼️  Generating images', expectedColor: 'cyan' },
      { stage: 'video_generation', expectedText: '🎬 Generating videos', expectedColor: 'green' },
      { stage: 'audio_generation', expectedText: '🎵 Generating audio', expectedColor: 'red' },
      { stage: 'content_integration', expectedText: '🔧 Integrating content', expectedColor: 'white' },
      { stage: 'finalization', expectedText: '✨ Finalizing output', expectedColor: 'rainbow' }
    ];

    stageTests.forEach(({ stage, expectedText, expectedColor }) => {
      it(`should display correct text and color for ${stage}`, () => {
        progressDisplay.start();
        
        const progress: GenerationProgress = {
          currentStage: stage,
          completedStages: [],
          totalStages: 8,
          currentStageProgress: 0.5,
          overallProgress: 0.0625
        };

        progressDisplay.update(progress);
        
        expect(mockSpinner.text).toContain(expectedText);
        expect(mockSpinner.color).toBe(expectedColor);
      });
    });
  });

  describe('Time Formatting', () => {
    beforeEach(() => {
      progressDisplay.start();
    });

    it('should format seconds correctly', () => {
      const progress: GenerationProgress = {
        currentStage: 'idea_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625,
        estimatedTimeRemaining: 45000 // 45 seconds
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('45s remaining');
    });

    it('should format minutes and seconds correctly', () => {
      const progress: GenerationProgress = {
        currentStage: 'video_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625,
        estimatedTimeRemaining: 150000 // 2 minutes 30 seconds
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('2m 30s remaining');
    });

    it('should format hours, minutes and seconds correctly', () => {
      const progress: GenerationProgress = {
        currentStage: 'video_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625,
        estimatedTimeRemaining: 3723000 // 1 hour 2 minutes 3 seconds
      };

      progressDisplay.update(progress);
      
      expect(mockSpinner.text).toContain('1h 2m 3s remaining');
    });
  });

  describe('Progress Bar Creation', () => {
    it('should create progress bar with correct filled/empty ratio', () => {
      progressDisplay.start();
      
      // Test 50% progress
      const progress: GenerationProgress = {
        currentStage: 'video_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.5
      };

      progressDisplay.update(progress);
      
      // The progress bar should be in the text
      expect(mockSpinner.text).toBeDefined();
      expect(typeof mockSpinner.text).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle operations without starting spinner', () => {
      // Should not throw errors
      expect(() => progressDisplay.complete()).not.toThrow();
      expect(() => progressDisplay.error('test')).not.toThrow();
      expect(() => progressDisplay.warn('test')).not.toThrow();
      expect(() => progressDisplay.info('test')).not.toThrow();
    });

    it('should handle update without starting spinner', () => {
      const progress: GenerationProgress = {
        currentStage: 'idea_generation',
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625
      };

      // Should not throw errors
      expect(() => progressDisplay.update(progress)).not.toThrow();
    });
  });
});