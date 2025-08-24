/**
 * Audio Synchronizer service for timing synchronization and mixing
 */

import { AudioTrack, Scene, ScriptScene } from '../types/content';
import { AudioResult } from '../types/api';

export interface AudioSyncConfig {
  maxTimingDifference: number; // Maximum acceptable timing difference in seconds
  defaultCrossfadeDuration: number; // Default crossfade duration in seconds
  maxVolumeAdjustment: number; // Maximum volume adjustment factor
}

export interface SyncedAudioTrack extends AudioTrack {
  startTime: number;
  endTime: number;
  originalDuration: number;
  adjustmentFactor: number;
  crossfadeIn?: number;
  crossfadeOut?: number;
}

export interface AudioMixResult {
  tracks: SyncedAudioTrack[];
  totalDuration: number;
  mixedAudioUrl: string;
  synchronizationReport: SynchronizationReport;
}

export interface SynchronizationReport {
  totalTracks: number;
  adjustedTracks: number;
  timingIssues: TimingIssue[];
  volumeAdjustments: VolumeAdjustment[];
  crossfades: CrossfadeInfo[];
}

export interface TimingIssue {
  trackIndex: number;
  trackType: string;
  expectedDuration: number;
  actualDuration: number;
  adjustment: string;
}

export interface VolumeAdjustment {
  trackIndex: number;
  trackType: string;
  originalVolume: number;
  adjustedVolume: number;
  reason: string;
}

export interface CrossfadeInfo {
  fromTrack: number;
  toTrack: number;
  duration: number;
  startTime: number;
}

export class AudioSynchronizer {
  private config: AudioSyncConfig;

  constructor(config?: Partial<AudioSyncConfig>) {
    this.config = {
      maxTimingDifference: 0.5, // 0.5 seconds
      defaultCrossfadeDuration: 1.0, // 1 second
      maxVolumeAdjustment: 2.0, // 2x volume adjustment max
      ...config
    };
  }

  /**
   * Synchronize audio tracks with video scene durations
   */
  async synchronizeWithScenes(
    audioTracks: AudioTrack[],
    audioResults: AudioResult[],
    scenes: Scene[],
    scriptScenes: ScriptScene[]
  ): Promise<AudioMixResult> {
    if (audioTracks.length !== audioResults.length) {
      throw new Error('Audio tracks and results arrays must have the same length');
    }

    const syncedTracks: SyncedAudioTrack[] = [];
    const report: SynchronizationReport = {
      totalTracks: audioTracks.length,
      adjustedTracks: 0,
      timingIssues: [],
      volumeAdjustments: [],
      crossfades: []
    };

    let currentTime = 0;

    // Process each audio track
    for (let i = 0; i < audioTracks.length; i++) {
      const audioTrack = audioTracks[i];
      const audioResult = audioResults[i];
      const scene = scenes[i];
      const scriptScene = scriptScenes.find(s => s.id === scene.scriptSceneId);

      if (!scriptScene) {
        throw new Error(`Script scene not found for scene ${scene.id}`);
      }

      const syncedTrack = await this.synchronizeTrack(
        audioTrack,
        audioResult,
        scriptScene,
        currentTime,
        report
      );

      syncedTracks.push(syncedTrack);
      currentTime = syncedTrack.endTime;
    }

    // Apply crossfades between tracks
    this.applyCrossfades(syncedTracks, report);

    // Balance volumes
    this.balanceVolumes(syncedTracks, report);

    // Generate mixed audio URL (placeholder)
    const mixedAudioUrl = `mixed-audio-${Date.now()}.mp3`;

    return {
      tracks: syncedTracks,
      totalDuration: currentTime,
      mixedAudioUrl,
      synchronizationReport: report
    };
  }

  /**
   * Synchronize a single audio track with its corresponding scene
   */
  private async synchronizeTrack(
    audioTrack: AudioTrack,
    audioResult: AudioResult,
    scriptScene: ScriptScene,
    startTime: number,
    report: SynchronizationReport
  ): Promise<SyncedAudioTrack> {
    const targetDuration = scriptScene.duration;
    const actualDuration = audioResult.duration;
    const timingDifference = Math.abs(targetDuration - actualDuration);

    let adjustmentFactor = 1.0;
    let adjustedDuration = actualDuration;

    // Check if timing adjustment is needed
    if (timingDifference > this.config.maxTimingDifference) {
      adjustmentFactor = targetDuration / actualDuration;
      adjustedDuration = targetDuration;
      
      report.adjustedTracks++;
      report.timingIssues.push({
        trackIndex: report.timingIssues.length,
        trackType: audioTrack.type,
        expectedDuration: targetDuration,
        actualDuration: actualDuration,
        adjustment: `Speed adjusted by factor ${adjustmentFactor.toFixed(3)}`
      });
    }

    const syncedTrack: SyncedAudioTrack = {
      ...audioTrack,
      duration: adjustedDuration,
      startTime,
      endTime: startTime + adjustedDuration,
      originalDuration: actualDuration,
      adjustmentFactor
    };

    return syncedTrack;
  }

  /**
   * Apply crossfades between overlapping or adjacent tracks
   */
  private applyCrossfades(tracks: SyncedAudioTrack[], report: SynchronizationReport): void {
    for (let i = 0; i < tracks.length - 1; i++) {
      const currentTrack = tracks[i];
      const nextTrack = tracks[i + 1];

      // Check if tracks are adjacent or overlapping
      const gap = nextTrack.startTime - currentTrack.endTime;
      
      if (Math.abs(gap) < this.config.defaultCrossfadeDuration) {
        const crossfadeDuration = Math.min(
          this.config.defaultCrossfadeDuration,
          currentTrack.duration * 0.1, // Max 10% of track duration
          nextTrack.duration * 0.1
        );

        // Apply crossfade
        currentTrack.crossfadeOut = crossfadeDuration;
        nextTrack.crossfadeIn = crossfadeDuration;

        report.crossfades.push({
          fromTrack: i,
          toTrack: i + 1,
          duration: crossfadeDuration,
          startTime: currentTrack.endTime - crossfadeDuration
        });
      }
    }
  }

  /**
   * Balance volumes across different track types
   */
  private balanceVolumes(tracks: SyncedAudioTrack[], report: SynchronizationReport): void {
    // Define target volumes for different track types
    const targetVolumes = {
      narration: 0.8,
      music: 0.3,
      effects: 0.5
    };

    tracks.forEach((track, index) => {
      const targetVolume = targetVolumes[track.type] || 0.5;
      const originalVolume = track.volume;

      // Calculate volume adjustment
      let adjustedVolume = targetVolume;
      
      // Ensure we don't exceed maximum adjustment
      const maxAdjustment = originalVolume * this.config.maxVolumeAdjustment;
      const minAdjustment = originalVolume / this.config.maxVolumeAdjustment;
      
      adjustedVolume = Math.max(minAdjustment, Math.min(maxAdjustment, adjustedVolume));

      // Apply adjustment if significant
      if (Math.abs(adjustedVolume - originalVolume) > 0.05) {
        track.volume = adjustedVolume;
        
        report.volumeAdjustments.push({
          trackIndex: index,
          trackType: track.type,
          originalVolume,
          adjustedVolume,
          reason: `Balanced for ${track.type} track type`
        });
      }
    });
  }

  /**
   * Mix multiple audio tracks into a single output
   */
  async mixAudioTracks(tracks: SyncedAudioTrack[]): Promise<string> {
    // In a real implementation, this would use audio processing libraries
    // to actually mix the audio files together
    
    // For now, we'll simulate the mixing process
    const mixedAudioUrl = `mixed-${Date.now()}.mp3`;
    
    // Simulate mixing process
    console.log(`Mixing ${tracks.length} audio tracks:`);
    tracks.forEach((track, index) => {
      console.log(`  Track ${index}: ${track.type} (${track.startTime}s - ${track.endTime}s, volume: ${track.volume})`);
    });
    
    return mixedAudioUrl;
  }

  /**
   * Validate audio synchronization requirements
   */
  validateSynchronization(
    audioTracks: AudioTrack[],
    scenes: ScriptScene[]
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if we have matching numbers of tracks and scenes
    if (audioTracks.length !== scenes.length) {
      issues.push(`Mismatch between audio tracks (${audioTracks.length}) and scenes (${scenes.length})`);
    }

    // Check for empty tracks
    audioTracks.forEach((track, index) => {
      if (track.duration <= 0) {
        issues.push(`Track ${index} has invalid duration: ${track.duration}`);
      }
      
      if (track.volume < 0 || track.volume > 1) {
        issues.push(`Track ${index} has invalid volume: ${track.volume}`);
      }
    });

    // Check scene durations
    scenes.forEach((scene, index) => {
      if (scene.duration <= 0) {
        issues.push(`Scene ${index} has invalid duration: ${scene.duration}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate total duration for synchronized audio
   */
  calculateTotalDuration(scenes: ScriptScene[]): number {
    return scenes.reduce((total, scene) => total + scene.duration, 0);
  }

  /**
   * Generate synchronization report summary
   */
  generateReportSummary(report: SynchronizationReport): string {
    const lines = [
      `Audio Synchronization Report`,
      `==========================`,
      `Total tracks processed: ${report.totalTracks}`,
      `Tracks requiring adjustment: ${report.adjustedTracks}`,
      `Timing issues resolved: ${report.timingIssues.length}`,
      `Volume adjustments made: ${report.volumeAdjustments.length}`,
      `Crossfades applied: ${report.crossfades.length}`
    ];

    if (report.timingIssues.length > 0) {
      lines.push('', 'Timing Adjustments:');
      report.timingIssues.forEach(issue => {
        lines.push(`  - ${issue.trackType}: ${issue.adjustment}`);
      });
    }

    if (report.volumeAdjustments.length > 0) {
      lines.push('', 'Volume Adjustments:');
      report.volumeAdjustments.forEach(adj => {
        lines.push(`  - ${adj.trackType}: ${adj.originalVolume.toFixed(2)} → ${adj.adjustedVolume.toFixed(2)}`);
      });
    }

    return lines.join('\n');
  }
}