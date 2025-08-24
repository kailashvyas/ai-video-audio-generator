/**
 * API-related interfaces and types
 */

export interface APIOperation {
  type: 'text' | 'image' | 'video' | 'audio';
  model: string;
  inputSize: number;
  outputSize?: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface APIError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface ErrorResolution {
  action: 'retry' | 'fallback' | 'abort';
  delay?: number;
  fallbackPrompt?: string;
}

export interface ImageResult {
  url: string;
  format: string;
  width: number;
  height: number;
  size: number;
}

export interface VideoResult {
  url: string;
  format: string;
  duration: number;
  width: number;
  height: number;
  size: number;
}

export interface AudioResult {
  url: string;
  format: string;
  duration: number;
  sampleRate: number;
  size: number;
}

export interface VoiceConfig {
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
}

export interface UsageStats {
  totalCost: number;
  requestCount: number;
  tokensUsed: number;
  quotaRemaining: number;
}

export interface CostReport {
  totalCost: number;
  breakdown: CostBreakdown[];
  period: {
    start: Date;
    end: Date;
  };
}

export interface CostBreakdown {
  service: string;
  operation: string;
  count: number;
  unitCost: number;
  totalCost: number;
}

// Error handling and recovery types
export interface ProgressState {
  projectId: string;
  currentStage: string;
  completedStages: string[];
  failedOperations: FailedOperation[];
  timestamp: Date;
  recoveryOptions: RecoveryOption[];
}

export interface FailedOperation {
  operation: string;
  error: APIError;
  timestamp: Date;
  retryCount: number;
  context: Record<string, any>;
}

export interface RecoveryOption {
  type: 'retry' | 'skip' | 'fallback' | 'manual';
  description: string;
  estimatedCost?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ErrorReport {
  projectId: string;
  errors: FailedOperation[];
  recoveryActions: RecoveryAction[];
  systemStatus: SystemStatus;
  recommendations: string[];
  timestamp: Date;
}

export interface RecoveryAction {
  action: string;
  success: boolean;
  timestamp: Date;
  details: string;
}

export interface SystemStatus {
  apiServices: ServiceStatus[];
  resourceUsage: ResourceUsage;
  degradationLevel: 'none' | 'partial' | 'severe';
}

export interface ServiceStatus {
  service: string;
  status: 'available' | 'degraded' | 'unavailable';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
}

export interface ResourceUsage {
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
}