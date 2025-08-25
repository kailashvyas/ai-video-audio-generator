# AI Content Generator CLI

A command-line interface for the AI Content Generator that provides interactive and programmatic access to multimedia content generation capabilities with cost-optimized defaults.

## Features

- **Interactive Mode**: Guided wizard for content generation
- **Command-line Arguments**: Direct generation with specified parameters
- **Configuration Management**: Persistent settings and API key management
- **Real-time Progress**: Live progress display with time estimates
- **System Status**: API connectivity and usage monitoring
- **Budget Control**: Cost estimation and limit enforcement
- **Cost Optimization**: Uses cheaper Veo 3.0 Fast model and 720p resolution by default

## Installation

The CLI is included with the AI Content Generator package. No additional installation required.

## Quick Start

### Interactive Mode (Recommended for beginners)

```bash
npm run cli:interactive
```

This starts an interactive wizard that guides you through:
- Topic selection
- Scene count configuration
- Budget setting
- Quality preferences
- Output format selection

### Direct Generation

```bash
npm run cli generate --topic "AI and Machine Learning" --scenes 3 --budget 25.00
```

### Configuration Management

```bash
# Initialize configuration file
npm run cli config --init

# View current settings
npm run cli config --show

# Update specific settings
npm run cli config --set defaultMaxScenes=10
npm run cli config --set defaultBudgetLimit=75.00
```

### System Status

```bash
npm run cli status
```

## Cost Optimization

The AI Content Generator uses cost-optimized defaults to minimize API usage costs while maintaining quality:

### Default Cost-Saving Settings

- **Model**: `veo-3.0-fast-generate-preview` (faster and cheaper than standard model)
- **Resolution**: `720p` (significantly cheaper than 1080p or 4k)
- **Quality**: `standard` (balanced quality vs cost)
- **Scenes**: `5` (reasonable content length)

### Cost Comparison

| Setting | Cost Impact | Quality Impact | Recommended For |
|---------|-------------|----------------|-----------------|
| **Model: Fast** | 🟢 Low cost | 🟡 Good quality | Most content, testing |
| **Model: Standard** | 🟡 Medium cost | 🟢 High quality | Professional content |
| **Resolution: 720p** | 🟢 Low cost | 🟡 Good for web | Social media, web content |
| **Resolution: 1080p** | 🟡 Medium cost | 🟢 High quality | Professional videos |
| **Resolution: 4k** | 🔴 High cost | 🟢 Premium quality | Premium productions |

### Cost Optimization Tips

1. **Start with defaults** for testing and iteration
2. **Use 720p resolution** for most content (web-ready quality)
3. **Choose fast model** unless premium quality is required
4. **Limit scene count** to control total costs
5. **Use draft quality** for rapid prototyping

### Budget Planning

Estimated costs per video scene (approximate):

- **720p + Fast Model**: ~$0.05-0.10 per scene
- **1080p + Fast Model**: ~$0.15-0.25 per scene  
- **720p + Standard Model**: ~$0.10-0.20 per scene
- **1080p + Standard Model**: ~$0.25-0.40 per scene

*Note: Actual costs may vary based on content complexity and API pricing*

## Commands

### `generate` (alias: `gen`)

Generate multimedia content from a topic or idea.

**Options:**
- `-t, --topic <topic>`: Content topic or theme
- `-s, --scenes <number>`: Maximum number of video scenes (default: 5)
- `-b, --budget <amount>`: Budget limit in USD (default: 50.00)
- `--image-to-video`: Use image-to-video generation for better character consistency
- `--formats <formats>`: Output formats, comma-separated (default: mp4)
- `--quality <quality>`: Generation quality - draft, standard, or high (default: standard)
- `--model <model>`: Veo model - veo-3.0-generate-preview or veo-3.0-fast-generate-preview (default: fast)
- `--resolution <res>`: Video resolution - 720p, 1080p, or 4k (default: 720p for cost optimization)
- `-c, --config <path>`: Custom configuration file path

**Examples:**

```bash
# Basic generation with topic
npm run cli generate --topic "Space Exploration"

# Advanced generation with custom settings
npm run cli generate \
  --topic "Cooking Tutorial" \
  --scenes 8 \
  --budget 100.00 \
  --image-to-video \
  --quality high \
  --resolution 1080p \
  --model veo-3.0-generate-preview \
  --formats mp4,webm

# Cost-optimized generation (uses defaults)
npm run cli generate \
  --topic "Budget-Friendly Content" \
  --scenes 5 \
  --budget 25.00

# Generate with random topic
npm run cli generate --scenes 3 --budget 20.00
```

### `interactive` (alias: `i`)

Start the interactive content generation wizard.

```bash
npm run cli interactive
```

The wizard will guide you through:
1. Topic selection or random generation
2. Scene count (1-20)
3. Budget limit
4. Generation mode (text-to-video vs image-to-video)
5. Quality level
6. Output formats
7. Confirmation and generation

### `config`

Manage configuration settings.

**Options:**
- `--init`: Initialize configuration file with defaults
- `--show`: Display current configuration
- `--set <key=value>`: Set a specific configuration value

**Configuration Keys:**
- `defaultMaxScenes`: Default number of scenes (number)
- `defaultBudgetLimit`: Default budget limit (number)
- `defaultUseImageToVideo`: Default generation mode (true/false)
- `defaultOutputFormats`: Default output formats (comma-separated)
- `defaultQuality`: Default quality level (draft/standard/high)
- `defaultModel`: Default Veo model (veo-3.0-fast-generate-preview/veo-3.0-generate-preview)
- `defaultResolution`: Default video resolution (720p/1080p/4k)
- `outputDirectory`: Output directory path (string)
- `tempDirectory`: Temporary files directory (string)
- `maxConcurrentRequests`: Max concurrent API requests (number)
- `logLevel`: Logging level (debug/info/warn/error)
- `autoConfirm`: Skip confirmation prompts (true/false)
- `showProgressDetails`: Show detailed progress (true/false)
- `saveProjectHistory`: Save project history (true/false)

**Examples:**

```bash
# Initialize config
npm run cli config --init

# View current settings
npm run cli config --show

# Update settings
npm run cli config --set defaultMaxScenes=8
npm run cli config --set defaultBudgetLimit=75.00
npm run cli config --set defaultQuality=high
npm run cli config --set autoConfirm=true
```

### `status`

Display system status and API usage information.

```bash
npm run cli status
```

Shows:
- API connectivity status (Gemini, MusicLM)
- Current usage statistics
- Cost information
- Configuration summary

## Configuration File

The CLI uses a configuration file located at `~/.ai-content-generator/config.json` to store default settings and preferences.

### Default Configuration

```json
{
  "defaultMaxScenes": 5,
  "defaultBudgetLimit": 50.00,
  "defaultUseImageToVideo": false,
  "defaultOutputFormats": ["mp4"],
  "defaultQuality": "standard",
  "defaultModel": "veo-3.0-fast-generate-preview",
  "defaultResolution": "720p",
  "outputDirectory": "./output",
  "tempDirectory": "./temp",
  "maxConcurrentRequests": 3,
  "logLevel": "info",
  "autoConfirm": false,
  "showProgressDetails": true,
  "saveProjectHistory": true
}
```

### API Keys

API keys are stored securely in the configuration file. You can update them using:

```bash
npm run cli config
# Select "Update API keys" from the interactive menu
```

Or set them via environment variables:
- `GEMINI_API_KEY`: Required for all generation features
- `MUSICLM_API_KEY`: Optional for music generation

## Progress Display

The CLI provides real-time progress updates during generation:

```
💡 Generating content idea ████████████████████░ (85%)
```

Progress includes:
- Current stage with emoji indicators
- Progress bar visualization
- Percentage completion
- Estimated time remaining
- Stage transition notifications

## Error Handling

The CLI includes comprehensive error handling:

- **Configuration Errors**: Invalid settings are caught and explained
- **API Errors**: Network issues and API failures are handled gracefully
- **Budget Limits**: Generation stops when budget limits are reached
- **Validation Errors**: Input validation with helpful error messages

## Examples

### Basic Workflow

1. **Initialize configuration:**
   ```bash
   npm run cli config --init
   ```

2. **Set your API key:**
   ```bash
   npm run cli config
   # Choose "Update API keys"
   ```

3. **Check system status:**
   ```bash
   npm run cli status
   ```

4. **Generate content interactively:**
   ```bash
   npm run cli interactive
   ```

### Advanced Usage

```bash
# High-quality generation with premium settings
npm run cli generate \
  --topic "Documentary about Ocean Life" \
  --scenes 10 \
  --budget 150.00 \
  --image-to-video \
  --quality high \
  --resolution 1080p \
  --model veo-3.0-generate-preview \
  --formats mp4,webm

# Cost-optimized generation (uses all defaults)
npm run cli generate \
  --topic "Budget Content" \
  --scenes 5 \
  --budget 25.00

# Quick draft generation with minimal cost
npm run cli generate \
  --topic "Quick Product Demo" \
  --scenes 3 \
  --budget 10.00 \
  --quality draft \
  --resolution 720p

# Batch configuration updates
npm run cli config --set defaultMaxScenes=12
npm run cli config --set defaultBudgetLimit=100.00
npm run cli config --set defaultQuality=high
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variable: GEMINI_API_KEY"**
   - Set your API key: `npm run cli config`
   - Or use environment variable: `export GEMINI_API_KEY=your_key_here`

2. **"Configuration file not found"**
   - Initialize config: `npm run cli config --init`

3. **"Budget limit exceeded"**
   - Increase budget: `npm run cli config --set defaultBudgetLimit=100.00`
   - Or use `--budget` option with higher value

4. **"Invalid quality value"**
   - Use valid values: `draft`, `standard`, or `high`

### Debug Mode

Enable debug logging for troubleshooting:

```bash
npm run cli config --set logLevel=debug
```

## Integration with Development Workflow

The CLI can be integrated into development and content creation workflows:

```bash
# Generate content for testing
npm run cli generate --topic "Test Content" --scenes 2 --budget 10.00 --quality draft

# Batch generation script
for topic in "Topic 1" "Topic 2" "Topic 3"; do
  npm run cli generate --topic "$topic" --scenes 3 --budget 25.00
done
```

## Performance & Cost Tips

### Cost Optimization
1. **Use default settings** for most content (720p + fast model)
2. **Start with 720p resolution** - excellent for web and social media
3. **Use fast model** unless premium quality is specifically required
4. **Limit scene count** to control total costs
5. **Use draft quality** for testing and iteration

### Performance Optimization
1. **Use text-to-video mode** for faster generation
2. **Enable auto-confirm** for batch operations
3. **Monitor usage** with `npm run cli status`
4. **Use smaller scene counts** for faster completion
5. **Consider parallel generation** for multiple projects

### Quality vs Cost Balance
- **Testing/Prototyping**: 720p + fast model + draft quality
- **Social Media**: 720p + fast model + standard quality (default)
- **Professional Web**: 1080p + fast model + standard quality
- **Premium Production**: 1080p + standard model + high quality

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the main project README
3. Check system status: `npm run cli status`
4. Enable debug logging for detailed error information