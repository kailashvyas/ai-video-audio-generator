/**
 * Idea Generator Service
 * Generates creative content ideas using Gemini Pro
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';

export interface IdeaGeneratorConfig {
  model?: string;
  creativity?: 'low' | 'medium' | 'high';
  contentType?: 'educational' | 'entertainment' | 'promotional' | 'documentary';
  targetAudience?: 'children' | 'teens' | 'adults' | 'seniors' | 'general';
  duration?: 'short' | 'medium' | 'long'; // 1-2 min, 3-5 min, 5+ min
}

export interface GeneratedIdea {
  title: string;
  description: string;
  theme: string;
  targetAudience: string;
  estimatedDuration: number;
  keyPoints: string[];
  visualStyle: string;
  mood: string;
}

export class IdeaGenerator {
  private geminiManager: GeminiAPIManager;
  private defaultConfig: IdeaGeneratorConfig;

  constructor(geminiManager: GeminiAPIManager, config: IdeaGeneratorConfig = {}) {
    this.geminiManager = geminiManager;
    this.defaultConfig = {
      model: 'gemini-pro',
      creativity: 'medium',
      contentType: 'entertainment',
      targetAudience: 'general',
      duration: 'medium',
      ...config
    };
  }

  /**
   * Generate a creative content idea based on a topic or theme
   */
  async generateIdea(topic?: string, config: IdeaGeneratorConfig = {}): Promise<GeneratedIdea> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    let prompt: string;
    
    if (topic) {
      prompt = this.buildTopicBasedPrompt(topic, finalConfig);
    } else {
      prompt = this.buildRandomIdeaPrompt(finalConfig);
    }

    try {
      const response = await this.geminiManager.generateText(prompt, finalConfig.model!);
      return this.parseIdeaResponse(response);
    } catch (error) {
      throw new Error(`Failed to generate idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple idea variations for a given topic
   */
  async generateIdeaVariations(topic: string, count: number = 3, config: IdeaGeneratorConfig = {}): Promise<GeneratedIdea[]> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const prompt = this.buildVariationsPrompt(topic, count, finalConfig);

    try {
      const response = await this.geminiManager.generateText(prompt, finalConfig.model!);
      return this.parseMultipleIdeasResponse(response);
    } catch (error) {
      throw new Error(`Failed to generate idea variations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a trending topic suggestion
   */
  async generateTrendingTopic(config: IdeaGeneratorConfig = {}): Promise<string> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const prompt = this.buildTrendingTopicPrompt(finalConfig);

    try {
      const response = await this.geminiManager.generateText(prompt, finalConfig.model!);
      return this.parseTrendingTopicResponse(response);
    } catch (error) {
      throw new Error(`Failed to generate trending topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build prompt for topic-based idea generation
   */
  private buildTopicBasedPrompt(topic: string, config: IdeaGeneratorConfig): string {
    const creativityInstructions = {
      low: 'Focus on practical, straightforward approaches.',
      medium: 'Balance creativity with accessibility.',
      high: 'Be highly creative and innovative, think outside the box.'
    };

    const durationGuidelines = {
      short: '1-2 minutes',
      medium: '3-5 minutes', 
      long: '5-10 minutes'
    };

    return `Generate a creative content idea for the topic: "${topic}"

Requirements:
- Content Type: ${config.contentType}
- Target Audience: ${config.targetAudience}
- Duration: ${durationGuidelines[config.duration!]}
- Creativity Level: ${creativityInstructions[config.creativity!]}

Please provide a structured response in the following JSON format:
{
  "title": "Engaging title for the content",
  "description": "Detailed description of the content concept (2-3 sentences)",
  "theme": "Main theme or message",
  "targetAudience": "${config.targetAudience}",
  "estimatedDuration": estimated_duration_in_seconds,
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "visualStyle": "Description of visual style and aesthetic",
  "mood": "Overall mood and tone (e.g., upbeat, mysterious, educational)"
}

Make sure the idea is:
- Engaging and memorable
- Suitable for video content
- Achievable with AI-generated assets
- Appropriate for the target audience
- Focused on visual storytelling`;
  }

  /**
   * Build prompt for random idea generation
   */
  private buildRandomIdeaPrompt(config: IdeaGeneratorConfig): string {
    const creativityInstructions = {
      low: 'Focus on popular, proven content formats.',
      medium: 'Mix popular formats with some creative twists.',
      high: 'Create unique, innovative content concepts.'
    };

    const durationGuidelines = {
      short: '1-2 minutes',
      medium: '3-5 minutes',
      long: '5-10 minutes'
    };

    return `Generate a creative and original content idea without a specific topic.

Requirements:
- Content Type: ${config.contentType}
- Target Audience: ${config.targetAudience}
- Duration: ${durationGuidelines[config.duration!]}
- Creativity Level: ${creativityInstructions[config.creativity!]}

Please provide a structured response in the following JSON format:
{
  "title": "Engaging title for the content",
  "description": "Detailed description of the content concept (2-3 sentences)",
  "theme": "Main theme or message",
  "targetAudience": "${config.targetAudience}",
  "estimatedDuration": estimated_duration_in_seconds,
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "visualStyle": "Description of visual style and aesthetic",
  "mood": "Overall mood and tone (e.g., upbeat, mysterious, educational)"
}

The idea should be:
- Original and engaging
- Suitable for video content
- Achievable with AI-generated assets
- Appropriate for the target audience
- Focused on visual storytelling
- Trending or timely if possible`;
  }

  /**
   * Build prompt for generating multiple idea variations
   */
  private buildVariationsPrompt(topic: string, count: number, config: IdeaGeneratorConfig): string {
    const durationGuidelines = {
      short: '1-2 minutes',
      medium: '3-5 minutes',
      long: '5-10 minutes'
    };

    return `Generate ${count} different creative content ideas for the topic: "${topic}"

Requirements:
- Content Type: ${config.contentType}
- Target Audience: ${config.targetAudience}
- Duration: ${durationGuidelines[config.duration!]}

Each idea should approach the topic from a different angle or perspective.

Please provide a structured response as a JSON array:
[
  {
    "title": "Title for variation 1",
    "description": "Description for variation 1",
    "theme": "Theme for variation 1",
    "targetAudience": "${config.targetAudience}",
    "estimatedDuration": duration_in_seconds,
    "keyPoints": ["point 1", "point 2", "point 3"],
    "visualStyle": "Visual style description",
    "mood": "Mood and tone"
  },
  // ... repeat for ${count} variations
]

Make each variation unique and creative while staying relevant to the topic.`;
  }

  /**
   * Build prompt for trending topic generation
   */
  private buildTrendingTopicPrompt(config: IdeaGeneratorConfig): string {
    return `Generate a trending topic suggestion that would be perfect for ${config.contentType} content targeting ${config.targetAudience}.

Consider current trends, seasonal relevance, and popular interests. The topic should be:
- Timely and relevant
- Engaging for the target audience
- Suitable for video content creation
- Not overly saturated in content

Please respond with just the topic as a clear, concise phrase or sentence. Do not include explanations or additional text.`;
  }

  /**
   * Parse the AI response into a GeneratedIdea object
   */
  private parseIdeaResponse(response: string): GeneratedIdea {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields and use defaults for missing ones
      const requiredFields = ['title', 'description', 'theme', 'targetAudience', 'estimatedDuration', 'keyPoints', 'visualStyle', 'mood'];
      const missingFields = requiredFields.filter(field => !(field in parsed));
      
      if (missingFields.length > 0) {
        // If critical fields are missing, fall back to default parsing
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      return {
        title: parsed.title || 'Generated Content Idea',
        description: parsed.description || 'A creative content idea generated by AI',
        theme: parsed.theme || 'General',
        targetAudience: parsed.targetAudience || this.defaultConfig.targetAudience!,
        estimatedDuration: parsed.estimatedDuration || 180,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['Engaging content', 'Visual storytelling', 'Audience connection'],
        visualStyle: parsed.visualStyle || 'Modern and engaging',
        mood: parsed.mood || 'Upbeat and informative'
      };
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      return this.fallbackParseIdea(response);
    }
  }

  /**
   * Parse multiple ideas from AI response
   */
  private parseMultipleIdeasResponse(response: string): GeneratedIdea[] {
    try {
      // Clean the response to extract JSON array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      return parsed.map((item, index) => {
        try {
          return this.parseIdeaResponse(JSON.stringify(item));
        } catch (error) {
          throw new Error(`Failed to parse idea ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
    } catch (error) {
      throw new Error(`Failed to parse multiple ideas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse trending topic from AI response
   */
  private parseTrendingTopicResponse(response: string): string {
    // Clean up the response and extract the topic
    return response.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Fallback parsing when JSON parsing fails
   */
  private fallbackParseIdea(response: string): GeneratedIdea {
    // Extract information using regex patterns as fallback
    const titleMatch = response.match(/"title"\s*:\s*"([^"]+)"/i) || response.match(/title[:\s]+([^,\n]+)/i);
    const descriptionMatch = response.match(/"description"\s*:\s*"([^"]+)"/i) || response.match(/description[:\s]+([^,\n]+)/i);
    const themeMatch = response.match(/"theme"\s*:\s*"([^"]+)"/i) || response.match(/theme[:\s]+([^,\n]+)/i);

    const extractedTitle = titleMatch?.[1]?.trim();
    const extractedDescription = descriptionMatch?.[1]?.trim();
    const extractedTheme = themeMatch?.[1]?.trim();

    return {
      title: (extractedTitle && extractedTitle.length > 0 && extractedTitle !== ':') ? extractedTitle : 'Generated Content Idea',
      description: (extractedDescription && extractedDescription.length > 0 && extractedDescription !== ':') ? extractedDescription : 'A creative content idea generated by AI',
      theme: (extractedTheme && extractedTheme.length > 0 && extractedTheme !== ':') ? extractedTheme : 'General',
      targetAudience: this.defaultConfig.targetAudience!,
      estimatedDuration: 180, // 3 minutes default
      keyPoints: ['Engaging content', 'Visual storytelling', 'Audience connection'],
      visualStyle: 'Modern and engaging',
      mood: 'Upbeat and informative'
    };
  }
}