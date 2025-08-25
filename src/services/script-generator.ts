/**
 * Script Generator Service
 * Converts ideas into structured scripts with scenes, dialogue, and timing
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { Script, ScriptScene } from '../types/content';
import { GeneratedIdea } from './idea-generator';

export interface ScriptGeneratorConfig {
  model?: string;
  maxScenes?: number;
  sceneLength?: 'short' | 'medium' | 'long'; // 15-30s, 30-60s, 60-90s
  includeDialogue?: boolean;
  narrativeStyle?: 'documentary' | 'storytelling' | 'educational' | 'conversational';
  pacing?: 'fast' | 'medium' | 'slow';
}

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ParsedCharacter {
  name: string;
  description: string;
  role: 'narrator' | 'main' | 'secondary' | 'background';
  appearances: string[]; // scene IDs where character appears
}

export class ScriptGenerator {
  private geminiManager: GeminiAPIManager;
  private defaultConfig: ScriptGeneratorConfig;

  constructor(geminiManager: GeminiAPIManager, config: ScriptGeneratorConfig = {}) {
    this.geminiManager = geminiManager;
    this.defaultConfig = {
      model: 'gemini-1.5-flash',
      maxScenes: 8,
      sceneLength: 'medium',
      includeDialogue: true,
      narrativeStyle: 'storytelling',
      pacing: 'medium',
      ...config
    };
  }

  /**
   * Generate a structured script from an idea
   */
  async generateScript(idea: GeneratedIdea, config: ScriptGeneratorConfig = {}): Promise<Script> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const prompt = this.buildScriptPrompt(idea, finalConfig);

    try {
      const response = await this.geminiManager.generateText(prompt, finalConfig.model!);
      const script = this.parseScriptResponse(response, idea);
      
      // Validate the generated script
      const validation = this.validateScript(script);
      if (!validation.isValid) {
        throw new Error(`Generated script validation failed: ${validation.errors.join(', ')}`);
      }

      return script;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 
                          (typeof error === 'object' && error !== null && 'message' in error) ? 
                          (error as any).message : String(error);
      throw new Error(`Failed to generate script: ${errorMessage}`);
    }
  }

  /**
   * Extract character information from a script
   */
  extractCharacters(script: Script): ParsedCharacter[] {
    const characterMap = new Map<string, ParsedCharacter>();

    script.scenes.forEach(scene => {
      scene.characters.forEach(characterName => {
        if (!characterMap.has(characterName)) {
          characterMap.set(characterName, {
            name: characterName,
            description: this.inferCharacterDescription(characterName, scene),
            role: this.inferCharacterRole(characterName, script),
            appearances: []
          });
        }
        
        const character = characterMap.get(characterName)!;
        if (!character.appearances.includes(scene.id)) {
          character.appearances.push(scene.id);
        }
      });
    });

    return Array.from(characterMap.values());
  }

  /**
   * Parse scene descriptions to extract visual cues and dialogue
   */
  parseSceneContent(sceneDescription: string): { visualCues: string[], dialogue: string[] } {
    const visualCues: string[] = [];
    const dialogue: string[] = [];

    // Split description into sentences
    const sentences = sceneDescription.split(/[.!?]+/).filter(s => s.trim().length > 0);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      
      // Check if it's dialogue (contains quotes or speech indicators)
      if (this.isDialogue(trimmed)) {
        dialogue.push(this.cleanDialogue(trimmed));
      } else if (this.isVisualCue(trimmed)) {
        visualCues.push(this.cleanVisualCue(trimmed));
      }
    });

    return { visualCues, dialogue };
  }

  /**
   * Validate script structure and content
   */
  validateScript(script: Script): ScriptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check basic structure
    if (!script.title || script.title.trim().length === 0) {
      errors.push('Script must have a title');
    }

    if (!script.description || script.description.trim().length === 0) {
      errors.push('Script must have a description');
    }

    if (!script.scenes || script.scenes.length === 0) {
      errors.push('Script must have at least one scene');
    }

    // Validate scenes
    script.scenes.forEach((scene, index) => {
      if (!scene.id || scene.id.trim().length === 0) {
        errors.push(`Scene ${index + 1} must have an ID`);
      }

      if (!scene.description || scene.description.trim().length === 0) {
        errors.push(`Scene ${index + 1} must have a description`);
      }

      if (scene.duration <= 0) {
        errors.push(`Scene ${index + 1} must have a positive duration`);
      }

      if (scene.duration > 120) {
        warnings.push(`Scene ${index + 1} is longer than 2 minutes, consider splitting`);
      }

      if (scene.characters.length === 0) {
        warnings.push(`Scene ${index + 1} has no characters`);
      }

      if (scene.visualCues.length === 0) {
        warnings.push(`Scene ${index + 1} has no visual cues`);
      }
    });

    // Check total duration
    if (script.estimatedDuration > 600) { // 10 minutes
      warnings.push('Script is longer than 10 minutes, consider shortening for better engagement');
    }

    if (script.estimatedDuration < 30) { // 30 seconds
      warnings.push('Script is very short, consider adding more content');
    }

    // Check scene flow
    if (script.scenes.length > 1) {
      const hasNarrator = script.scenes.some(scene => 
        scene.characters.some(char => char.toLowerCase().includes('narrator'))
      );
      
      if (!hasNarrator && script.scenes.every(scene => scene.dialogue.length === 0)) {
        suggestions.push('Consider adding a narrator or dialogue for better storytelling');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Build the prompt for script generation
   */
  private buildScriptPrompt(idea: GeneratedIdea, config: ScriptGeneratorConfig): string {
    const sceneLengthGuidelines = {
      short: '15-30 seconds',
      medium: '30-60 seconds',
      long: '60-90 seconds'
    };

    const narrativeStyleInstructions = {
      documentary: 'Use a documentary style with factual narration and educational tone',
      storytelling: 'Use narrative storytelling with character development and plot progression',
      educational: 'Focus on teaching and explaining concepts clearly',
      conversational: 'Use a casual, conversational tone as if talking to a friend'
    };

    const pacingInstructions = {
      fast: 'Quick cuts, rapid information delivery, high energy',
      medium: 'Balanced pacing with good rhythm and flow',
      slow: 'Deliberate pacing, time for reflection, contemplative'
    };

    return `Generate a detailed script based on this content idea:

IDEA DETAILS:
Title: ${idea.title}
Description: ${idea.description}
Theme: ${idea.theme}
Target Audience: ${idea.targetAudience}
Key Points: ${idea.keyPoints.join(', ')}
Visual Style: ${idea.visualStyle}
Mood: ${idea.mood}

SCRIPT REQUIREMENTS:
- Maximum Scenes: ${config.maxScenes}
- Scene Length: ${sceneLengthGuidelines[config.sceneLength!]}
- Include Dialogue: ${config.includeDialogue ? 'Yes' : 'No'}
- Narrative Style: ${narrativeStyleInstructions[config.narrativeStyle!]}
- Pacing: ${pacingInstructions[config.pacing!]}

Please provide a structured response in the following JSON format:
{
  "title": "Script title",
  "description": "Brief script description",
  "scenes": [
    {
      "id": "scene_1",
      "description": "Detailed scene description including action, setting, and what happens",
      "dialogue": ["Line 1 of dialogue", "Line 2 of dialogue"],
      "characters": ["Character 1", "Character 2", "Narrator"],
      "visualCues": ["Visual element 1", "Visual element 2", "Camera direction"],
      "duration": duration_in_seconds
    }
  ],
  "estimatedDuration": total_duration_in_seconds
}

IMPORTANT GUIDELINES:
1. Each scene should advance the story or convey key information
2. Include specific visual descriptions for AI video generation
3. Character names should be consistent across scenes
4. Dialogue should sound natural and age-appropriate
5. Visual cues should be detailed enough for video generation prompts
6. Scene descriptions should include setting, lighting, and mood
7. Ensure smooth transitions between scenes
8. Keep the overall message aligned with the original idea

Make the script engaging, visually rich, and suitable for AI-generated video content.`;
  }

  /**
   * Parse the AI response into a Script object
   */
  private parseScriptResponse(response: string, idea: GeneratedIdea): Script {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and construct script
      const script: Script = {
        title: parsed.title || idea.title,
        description: parsed.description || idea.description,
        scenes: [],
        estimatedDuration: 0
      };

      // Parse scenes
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        script.scenes = parsed.scenes.map((sceneData: any, index: number) => {
          const scene: ScriptScene = {
            id: sceneData.id || `scene_${index + 1}`,
            description: sceneData.description || '',
            dialogue: Array.isArray(sceneData.dialogue) ? sceneData.dialogue : [],
            characters: Array.isArray(sceneData.characters) ? sceneData.characters : [],
            visualCues: Array.isArray(sceneData.visualCues) ? sceneData.visualCues : [],
            duration: typeof sceneData.duration === 'number' ? sceneData.duration : 30
          };

          // If visual cues or dialogue are missing, try to extract from description
          if (scene.visualCues.length === 0 || scene.dialogue.length === 0) {
            const extracted = this.parseSceneContent(scene.description);
            if (scene.visualCues.length === 0) {
              scene.visualCues = extracted.visualCues;
            }
            if (scene.dialogue.length === 0) {
              scene.dialogue = extracted.dialogue;
            }
          }

          return scene;
        });
      }

      // Calculate total duration
      script.estimatedDuration = parsed.estimatedDuration || 
        script.scenes.reduce((total, scene) => total + scene.duration, 0);

      return script;
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      return this.fallbackParseScript(response, idea);
    }
  }

  /**
   * Infer character description from scene context
   */
  private inferCharacterDescription(characterName: string, scene: ScriptScene): string {
    const name = characterName.toLowerCase();
    
    if (name.includes('narrator') || name.includes('voice')) {
      return 'Narrator providing voice-over commentary';
    }
    
    if (name.includes('host') || name.includes('presenter')) {
      return 'Main presenter or host of the content';
    }
    
    // Try to extract description from scene context
    const sceneText = scene.description.toLowerCase();
    if (sceneText.includes(name)) {
      const sentences = scene.description.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(name)) {
          return sentence.trim();
        }
      }
    }
    
    return `Character appearing in the content`;
  }

  /**
   * Infer character role based on appearances across script
   */
  private inferCharacterRole(characterName: string, script: Script): 'narrator' | 'main' | 'secondary' | 'background' {
    const name = characterName.toLowerCase();
    
    if (name.includes('narrator') || name.includes('voice')) {
      return 'narrator';
    }
    
    const appearances = script.scenes.filter(scene => 
      scene.characters.some(char => char.toLowerCase() === name)
    ).length;
    
    const totalScenes = script.scenes.length;
    const appearanceRatio = appearances / totalScenes;
    
    if (appearanceRatio >= 0.7) return 'main';
    if (appearanceRatio >= 0.3) return 'secondary';
    return 'background';
  }

  /**
   * Check if a sentence contains dialogue
   */
  private isDialogue(sentence: string): boolean {
    return /["'].*["']/.test(sentence) || 
           /\bsays?\b|\bsaid\b|\bspeak[s]?\b|\btell[s]?\b/i.test(sentence) ||
           sentence.includes(':') && sentence.split(':').length === 2;
  }

  /**
   * Check if a sentence describes visual elements
   */
  private isVisualCue(sentence: string): boolean {
    const visualKeywords = [
      'see', 'show', 'display', 'appear', 'visible', 'camera', 'shot', 'view',
      'background', 'foreground', 'lighting', 'color', 'movement', 'action',
      'close-up', 'wide shot', 'zoom', 'pan', 'fade', 'cut'
    ];
    
    return visualKeywords.some(keyword => 
      sentence.toLowerCase().includes(keyword)
    );
  }

  /**
   * Clean and format dialogue text
   */
  private cleanDialogue(text: string): string {
    return text
      .replace(/^.*?["']/, '') // Remove everything before opening quote
      .replace(/["'].*?$/, '') // Remove closing quote and everything after
      .replace(/\b(says?|said|speaks?|tells?)\b.*?:/i, '') // Remove speech indicators
      .trim();
  }

  /**
   * Clean and format visual cue text
   */
  private cleanVisualCue(text: string): string {
    return text
      .replace(/^\W+/, '') // Remove leading punctuation
      .replace(/\W+$/, '') // Remove trailing punctuation
      .trim();
  }

  /**
   * Fallback parsing when JSON parsing fails
   */
  private fallbackParseScript(response: string, idea: GeneratedIdea): Script {
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    
    const script: Script = {
      title: idea.title,
      description: idea.description,
      scenes: [],
      estimatedDuration: idea.estimatedDuration
    };

    // Try to extract scenes from text format
    let currentScene: Partial<ScriptScene> | null = null;
    let sceneCounter = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for scene markers
      if (/scene\s*\d+/i.test(trimmed) || /^scene/i.test(trimmed)) {
        if (currentScene) {
          script.scenes.push(this.completeScene(currentScene, sceneCounter - 1));
        }
        currentScene = {
          id: `scene_${sceneCounter}`,
          description: '',
          dialogue: [],
          characters: [],
          visualCues: [],
          duration: 30
        };
        sceneCounter++;
      } else if (currentScene && trimmed.length > 0) {
        // Add content to current scene
        currentScene.description += (currentScene.description ? ' ' : '') + trimmed;
      }
    }

    // Add the last scene
    if (currentScene) {
      script.scenes.push(this.completeScene(currentScene, sceneCounter - 1));
    }

    // If no scenes were found, create a single scene from the entire response
    if (script.scenes.length === 0) {
      const extracted = this.parseSceneContent(response);
      script.scenes.push({
        id: 'scene_1',
        description: response.substring(0, 200) + '...',
        dialogue: extracted.dialogue,
        characters: ['Narrator'],
        visualCues: extracted.visualCues,
        duration: idea.estimatedDuration
      });
    }

    return script;
  }

  /**
   * Complete a partial scene with extracted content
   */
  private completeScene(partialScene: Partial<ScriptScene>, index: number): ScriptScene {
    const description = partialScene.description || `Scene ${index + 1}`;
    const extracted = this.parseSceneContent(description);
    
    return {
      id: partialScene.id || `scene_${index + 1}`,
      description,
      dialogue: partialScene.dialogue?.length ? partialScene.dialogue : extracted.dialogue,
      characters: partialScene.characters?.length ? partialScene.characters : ['Narrator'],
      visualCues: partialScene.visualCues?.length ? partialScene.visualCues : extracted.visualCues,
      duration: partialScene.duration || 30
    };
  }
}