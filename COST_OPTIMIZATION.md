# Cost Optimization Guide

## 💰 Overview

The AI Content Generator uses cost-optimized defaults to minimize API usage while maintaining excellent quality. This guide explains the cost structure and how to optimize your usage.

## 🎯 Default Cost-Optimized Settings

The system automatically uses the most cost-effective settings:

- **Model**: `veo-3.0-fast-generate-preview` (faster and cheaper than standard)
- **Resolution**: `720p` (excellent web quality, significantly cheaper than 1080p)
- **Quality**: `standard` (balanced quality vs cost)
- **Duration**: `5 seconds` per scene (optimal for most content)

## 📊 Cost Comparison

### Per Scene Estimates (Approximate)

| Configuration | Estimated Cost | Quality | Best For |
|---------------|----------------|---------|----------|
| **720p + Fast Model** (Default) | $0.05-0.10 | 🟢 Excellent | Social media, web content, testing |
| **1080p + Fast Model** | $0.15-0.25 | 🟢 High | Professional web content |
| **720p + Standard Model** | $0.10-0.20 | 🟢 Premium | High-quality web content |
| **1080p + Standard Model** | $0.25-0.40 | 🟢 Premium | Professional productions |

### Total Project Costs (5 scenes)

- **Cost-Optimized** (Default): ~$0.25-0.50
- **Balanced Quality**: ~$0.75-1.25
- **Premium Quality**: ~$1.25-2.00
- **Maximum Quality**: ~$2.00-4.00

## 🚀 Quick Start Examples

### Cost-Optimized Generation (Recommended)
```bash
# Uses all default cost-optimized settings
npm run example:veo3

# Or with CLI
npm run cli generate --topic "Your Topic" --scenes 5 --budget 25.00
```

### Test Different Cost Settings
```bash
# Compare cost vs quality trade-offs
npm run example:cost
```

### Custom Cost Settings
```typescript
// Cost-optimized (default)
const result = await veoManager.generateTextToVideo(prompt, {
  model: 'veo-3.0-fast-generate-preview', // Cheaper
  resolution: '720p', // Lower cost
  quality: 'standard'
});

// Premium quality (higher cost)
const result = await veoManager.generateTextToVideo(prompt, {
  model: 'veo-3.0-generate-preview', // More expensive
  resolution: '1080p', // Higher cost
  quality: 'high'
});
```

## 💡 Cost Optimization Strategies

### 1. Start with Defaults
- Always begin with default settings for testing and iteration
- The 720p + fast model combination provides excellent quality for most use cases
- Only upgrade settings when specifically needed

### 2. Progressive Quality Scaling
```bash
# Phase 1: Prototype with minimal cost
npm run cli generate --topic "Test" --scenes 3 --quality draft --resolution 720p

# Phase 2: Refine with standard settings (default)
npm run cli generate --topic "Test" --scenes 5 --quality standard

# Phase 3: Final production with premium settings (if needed)
npm run cli generate --topic "Final" --scenes 5 --quality high --resolution 1080p
```

### 3. Scene Count Management
- **Testing**: 2-3 scenes (~$0.10-0.30)
- **Social Media**: 3-5 scenes (~$0.15-0.50)
- **Professional Content**: 5-8 scenes (~$0.25-0.80)
- **Long-form Content**: 8+ scenes (budget accordingly)

### 4. Budget Planning
```bash
# Set appropriate budgets for different use cases
npm run cli config --set defaultBudgetLimit=10.00  # Testing
npm run cli config --set defaultBudgetLimit=25.00  # Social media
npm run cli config --set defaultBudgetLimit=50.00  # Professional
npm run cli config --set defaultBudgetLimit=100.00 # Premium projects
```

## 🎛️ Configuration Options

### Model Selection
- **veo-3.0-fast-generate-preview**: Faster, cheaper, excellent quality
- **veo-3.0-generate-preview**: Slower, more expensive, premium quality

### Resolution Options
- **720p**: 1280x720, cost-optimized, perfect for web/social
- **1080p**: 1920x1080, higher cost, professional quality
- **4k**: 3840x2160, highest cost, premium productions only

### Quality Levels
- **draft**: Fastest generation, lowest cost, good for testing
- **standard**: Balanced quality and cost (recommended default)
- **high**: Best quality, highest cost, for final deliverables

## 📈 Monitoring and Control

### Real-time Cost Tracking
```bash
# Check current usage and costs
npm run cli status

# Monitor during generation
# The system displays real-time cost estimates and warnings
```

### Budget Controls
- Set budget limits to prevent overruns
- Get warnings at 80% of budget limit
- Automatic stopping when budget is exceeded
- Cost estimation before generation starts

## 🏆 Best Practices

### For Different Use Cases

**Testing & Development**
```bash
npm run cli generate --scenes 2 --budget 5.00 --quality draft
```

**Social Media Content**
```bash
npm run cli generate --scenes 5 --budget 15.00
# Uses cost-optimized defaults: 720p + fast model
```

**Professional Web Content**
```bash
npm run cli generate --scenes 5 --budget 35.00 --resolution 1080p
```

**Premium Productions**
```bash
npm run cli generate --scenes 8 --budget 75.00 --resolution 1080p --model veo-3.0-generate-preview --quality high
```

### Cost Monitoring Tips

1. **Always check estimates** before starting generation
2. **Use status command** to monitor usage: `npm run cli status`
3. **Set appropriate budgets** for different project types
4. **Start small** and scale up as needed
5. **Monitor file sizes** - larger files indicate higher processing costs

## 🔧 Advanced Cost Control

### Batch Processing
```bash
# Process multiple topics with cost control
for topic in "Topic 1" "Topic 2" "Topic 3"; do
  npm run cli generate --topic "$topic" --scenes 3 --budget 10.00
done
```

### Configuration Presets
```bash
# Set up cost-optimized defaults
npm run cli config --set defaultModel=veo-3.0-fast-generate-preview
npm run cli config --set defaultResolution=720p
npm run cli config --set defaultMaxScenes=5
npm run cli config --set defaultBudgetLimit=25.00
```

## 📞 Support

For cost-related questions:
1. Run `npm run example:cost` to see cost comparisons
2. Use `npm run cli status` to check current usage
3. Review this guide for optimization strategies
4. Start with defaults and upgrade only when needed

---

*Remember: The default settings provide excellent quality for most use cases while keeping costs minimal. Always test with defaults before upgrading to premium settings.*