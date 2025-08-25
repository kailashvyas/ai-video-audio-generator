/**
 * Real-time progress display for content generation
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { GenerationProgress, GenerationStage } from '../types';

export class ProgressDisplay {
  private spinner: Ora | null = null;
  private currentStage: GenerationStage | null = null;
  private startTime: number = 0;

  /**
   * Start progress display
   */
  start(): void {
    this.startTime = Date.now();
    this.spinner = ora({
      text: 'Initializing content generation...',
      color: 'blue'
    }).start();
  }

  /**
   * Update progress display
   */
  update(progress: GenerationProgress): void {
    if (!this.spinner) return;

    const stageText = this.getStageDisplayText(progress.currentStage);
    const progressBar = this.createProgressBar(progress.currentStageProgress);
    const overallProgress = Math.round(progress.overallProgress * 100);
    
    // Update spinner text
    this.spinner.text = `${stageText} ${progressBar} (${overallProgress}%)`;
    
    // Change spinner color based on stage
    const color = this.getStageColor(progress.currentStage) as any;
    this.spinner.color = color;
    
    // Log stage transitions
    if (this.currentStage !== progress.currentStage) {
      if (this.currentStage) {
        this.spinner.succeed(chalk.green(`✅ ${this.getStageDisplayText(this.currentStage)} completed`));
        this.spinner = ora().start();
      }
      this.currentStage = progress.currentStage;
    }

    // Show estimated time remaining if available
    if (progress.estimatedTimeRemaining) {
      const timeText = this.formatTime(progress.estimatedTimeRemaining);
      this.spinner.text += chalk.gray(` (${timeText} remaining)`);
    }
  }

  /**
   * Complete progress display
   */
  complete(): void {
    if (!this.spinner) return;

    const totalTime = Date.now() - this.startTime;
    const timeText = this.formatTime(totalTime);
    
    this.spinner.succeed(chalk.green(`🎉 Content generation completed in ${timeText}`));
    this.spinner = null;
  }

  /**
   * Show error and stop spinner
   */
  error(message: string): void {
    if (!this.spinner) return;

    this.spinner.fail(chalk.red(`❌ ${message}`));
    this.spinner = null;
  }

  /**
   * Show warning message
   */
  warn(message: string): void {
    if (this.spinner) {
      this.spinner.warn(chalk.yellow(`⚠️  ${message}`));
    } else {
      console.log(chalk.yellow(`⚠️  ${message}`));
    }
  }

  /**
   * Show info message
   */
  info(message: string): void {
    if (this.spinner) {
      this.spinner.info(chalk.blue(`ℹ️  ${message}`));
    } else {
      console.log(chalk.blue(`ℹ️  ${message}`));
    }
  }

  /**
   * Get display text for generation stage
   */
  private getStageDisplayText(stage: GenerationStage): string {
    const stageTexts: Record<GenerationStage, string> = {
      'idea_generation': '💡 Generating content idea',
      'script_creation': '📝 Creating script',
      'character_analysis': '👥 Analyzing characters',
      'image_generation': '🖼️  Generating images',
      'video_generation': '🎬 Generating videos',
      'audio_generation': '🎵 Generating audio',
      'content_integration': '🔧 Integrating content',
      'finalization': '✨ Finalizing output'
    };
    
    return stageTexts[stage] || 'Processing...';
  }

  /**
   * Get color for generation stage
   */
  private getStageColor(stage: GenerationStage): string {
    const stageColors: Record<GenerationStage, string> = {
      'idea_generation': 'yellow',
      'script_creation': 'blue',
      'character_analysis': 'magenta',
      'image_generation': 'cyan',
      'video_generation': 'green',
      'audio_generation': 'red',
      'content_integration': 'white',
      'finalization': 'rainbow'
    };
    
    return stageColors[stage] || 'blue';
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round(progress * width);
    const empty = width - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return chalk.green(filledBar) + chalk.gray(emptyBar);
  }

  /**
   * Format time duration
   */
  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}