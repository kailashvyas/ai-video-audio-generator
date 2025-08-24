/**
 * Configuration interfaces and types
 */

import { ContentProject } from "./content";

export interface ContentConfig {
  topic?: string;
  maxScenes: number;
  budgetLimit: number;
  useImageToVideo: boolean;
  outputFormats: string[];
  quality: 'draft' | 'standard' | 'high';
}

export interface GenerationProgress {
  currentStage: GenerationStage;
  completedStages: GenerationStage[];
  totalStages: number;
  currentStageProgress: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
}

export type GenerationStage = 
  | 'idea_generation'
  | 'script_creation'
  | 'character_analysis'
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation'
  | 'content_integration'
  | 'finalization';

export interface ContentResult {
  project: ContentProject;
  success: boolean;
  errors: string[];
  warnings: string[];
  finalOutputPath?: string;
  summary: GenerationSummary;
}

export interface GenerationSummary {
  totalDuration: number;
  scenesGenerated: number;
  charactersCreated: number;
  totalCost: number;
  apiCallsUsed: number;
  outputFiles: string[];
}

export interface EnvironmentConfig {
  geminiApiKey: string;
  musicLmApiKey: string;
  outputDirectory: string;
  tempDirectory: string;
  maxConcurrentRequests: number;
  defaultBudgetLimit: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}