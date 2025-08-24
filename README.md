# AI Content Generator

An AI-powered multimedia content generation system that automatically creates complete content packages including ideas, scripts, videos, and audio using Google's Gemini API suite.

## Features

- **Automated Content Creation**: Generate ideas, scripts, videos, and audio automatically
- **Character Consistency**: Maintain visual and narrative consistency across scenes
- **Cost Control**: Built-in budget management and API usage tracking
- **Multiple Output Formats**: Support for various video and audio formats
- **Professional Quality**: Leverages Google's advanced AI models for high-quality output

## Prerequisites

- Node.js 18.0.0 or higher
- Google Gemini API access (required)
  - Includes Veo video generation capabilities
- Optional: MusicLM API access for music generation (currently in limited preview)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Configure your API keys in the `.env` file

## Configuration

Edit the `.env` file with your API keys and preferences:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (when available)
# MUSICLM_API_KEY=your_musiclm_api_key_here
```

**Note**: Your Gemini API key now includes access to Veo video generation capabilities. MusicLM is still in limited preview.

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## Project Structure

```
src/
├── api/          # External API integrations
├── config/       # Configuration management
├── managers/     # Orchestration components
├── models/       # Data models (deprecated, use types/)
├── services/     # Business logic services
├── types/        # TypeScript type definitions
└── utils/        # Helper utilities
```

## API Integration

This system integrates with multiple Google AI services:

- **Gemini Pro/Ultra**: Text and idea generation
- **Gemini Vision**: Image generation and analysis
- **Gemini + Veo**: Video generation (text-to-video and image-to-video)
- **Text-to-Speech**: Audio narration
- **MusicLM**: Background music generation (when available)

## License

MIT License - see LICENSE file for details.