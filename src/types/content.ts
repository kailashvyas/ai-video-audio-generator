/**
 * Core data models for the AI Content Generator system
 */

export interface ContentProject {
  id: string;
  topic: string;
  idea: string;
  script: Script;
  characters: Character[];
  scenes: Scene[];
  audioTracks: AudioTrack[];
  finalVideo?: string;
  metadata: ProjectMetadata;
}

export interface Script {
  title: string;
  description: string;
  scenes: ScriptScene[];
  estimatedDuration: number;
}

export interface ScriptScene {
  id: string;
  description: string;
  dialogue: string[];
  characters: string[];
  visualCues: string[];
  duration: number;
}

export interface Character {
  name: string;
  description: string;
  referenceImage?: string;
  appearances: SceneReference[];
}

export interface SceneReference {
  sceneId: string;
  role: string;
  prominence: 'main' | 'secondary' | 'background';
}

export interface Scene {
  id: string;
  scriptSceneId: string;
  videoPrompt: string;
  referenceImage?: string;
  generatedVideo?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface AudioTrack {
  type: 'narration' | 'music' | 'effects';
  content: string;
  duration: number;
  volume: number;
}

export interface ProjectMetadata {
  createdAt: Date;
  updatedAt: Date;
  totalCost: number;
  apiUsage: APIUsageStats;
  generationSettings: GenerationSettings;
}

export interface APIUsageStats {
  textGeneration: number;
  imageGeneration: number;
  videoGeneration: number;
  audioGeneration: number;
  totalRequests: number;
}

export interface GenerationSettings {
  maxScenes: number;
  budgetLimit: number;
  useImageToVideo: boolean;
  outputFormats: string[];
  quality: 'draft' | 'standard' | 'high';
}