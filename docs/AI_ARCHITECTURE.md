# AI Architecture Documentation

## Overview

This document describes the AI architecture foundation for the Forex Trading Journal application. The architecture is designed to be:

- **Provider-agnostic**: Works with any AI provider (OpenAI, Qwen, Gemini, Claude, etc.)
- **Secure**: Never exposes database directly to AI, respects RLS
- **Privacy-focused**: Minimizes data sent to AI providers
- **Cost-effective**: Compatible with free tier, supports caching
- **Safe**: No automatic mutations, user confirmation required

## Architecture Principles

### 1. No Direct Database Access

AI **NEVER** has direct access to the database. Instead:

```
User Request
    ↓
AI Intent Parser
    ↓
Validated Query Plan
    ↓
Existing Analytics Services
    ↓
Sanitized Context
    ↓
AI Provider
    ↓
Validated Response
    ↓
UI
```

### 2. Provider Abstraction

All AI interactions go through a provider abstraction layer:

```typescript
interface AIProvider {
  generateText(prompt: string): Promise<AIResponse<string>>;
  generateStructured<T>(prompt: string, schema: Schema): Promise<AIResponse<T>>;
  isAvailable(): boolean;
}
```

This allows switching providers without changing business logic.

### 3. Mock Provider for Development

The application includes a Mock AI Provider that:
- Works without any API key
- Returns deterministic responses
- Allows UI development and testing
- Falls back automatically when no real provider is configured

### 4. Query DSL (Domain Specific Language)

AI queries are converted to a structured Query DSL:

```typescript
interface AIQueryPlan {
  metrics: AIMetric[];        // e.g., 'totalTrades', 'winRate'
  dimensions?: AIDimension[]; // e.g., 'symbol', 'side'
  filters?: AIFilter[];       // e.g., { field: 'symbol', operator: 'equals', value: 'EURUSD' }
  dateRange?: { start: string; end: string };
  groupBy?: AIDimension;
  sortBy?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
}
```

**Only allowlisted metrics and dimensions are permitted.**

### 5. Validation Layer

Every AI-generated query plan is validated before execution:

- ✅ Metrics must be in allowlist
- ✅ Dimensions must be in allowlist
- ✅ Filters must use allowed operators
- ✅ Date ranges must be valid
- ✅ Limits must be reasonable
- ✅ SQL injection patterns are rejected

### 6. Context Builder

The Context Builder:
- Collects only necessary data
- Sanitizes user-generated text (prevents prompt injection)
- Respects user ownership (RLS)
- Minimizes data sent to AI
- Estimates token count

### 7. Privacy & Security

#### Data Isolation
- AI only sees data belonging to authenticated user
- RLS is enforced at database level
- Cross-user access is impossible

#### Screenshot Privacy
- Screenshots are **NOT** sent to AI by default
- Future screenshot analysis requires explicit user opt-in
- Uses signed URLs with expiry

#### Prompt Injection Defense
- User-generated text is sanitized
- Common injection patterns are filtered
- System prompts are separated from user data

#### No Automatic Mutations
- AI can only **suggest** changes
- User must explicitly approve any mutations
- No silent database modifications

## File Structure

```
src/services/ai/
├── types.ts                 # TypeScript interfaces
├── mock-provider.ts         # Mock AI provider
├── provider-registry.ts     # Provider management
├── feature-registry.ts      # Feature configuration
├── validation.ts            # Query validation
├── context-builder.ts       # Context construction
├── query/                   # (Future) Query execution
├── review/                  # (Future) Trade review
├── tagging/                 # (Future) Auto-tagging
└── reports/                 # (Future) Report generation
```

## Usage Examples

### Using Mock Provider (Default)

```typescript
import { getCurrentAIProvider } from './services/ai/provider-registry';

const provider = getCurrentAIProvider();
const response = await provider.generateText('How many trades do I have?');
console.log(response.data); // Mock response
```

### Configuring a Real Provider (Future)

**IMPORTANT:** Real AI providers require a **server-side API boundary**. Never expose API keys in the browser.

The intended architecture for production:

```
Browser (React)
    ↓
Vercel Serverless Function (API Route)
    ↓
AI Provider (OpenAI/Qwen/etc.)
    ↓
Validated Query Plan
    ↓
Existing Analytics Services
    ↓
Sanitized Context
    ↓
AI Response
    ↓
Browser
```

**DO NOT** use `VITE_OPENAI_API_KEY` or any browser-side API keys.

For development/testing, use the Mock Provider (no API key required).

For production, implement a serverless function that:
1. Receives the request from the browser
2. Validates the user's authentication
3. Calls the AI provider with the server-side API key
4. Returns the response to the browser

### Validating a Query Plan

```typescript
import { validateQueryPlan } from './services/ai/validation';

const query = {
  metrics: ['totalTrades', 'winRate'],
  filters: [{ field: 'symbol', operator: 'equals', value: 'EURUSD' }]
};

const result = validateQueryPlan(query);
if (result.valid) {
  // Execute query
} else {
  console.error('Invalid query:', result.errors);
}
```

### Building AI Context

```typescript
import { buildAIContext } from './services/ai/context-builder';

const context = await buildAIContext(
  {
    userId: 'user-123',
    accountId: 'account-1',
    includeTrades: true,
    maxTrades: 50
  },
  trades,
  accounts,
  phases,
  metrics
);
```

## Security Model

### What AI CAN Do
- ✅ Read sanitized, validated data
- ✅ Generate text responses
- ✅ Suggest tags (requires user approval)
- ✅ Analyze patterns in user's own data
- ✅ Generate reports based on analytics

### What AI CANNOT Do
- ❌ Access database directly
- ❌ Execute arbitrary SQL
- ❌ Access other users' data
- ❌ Modify data without user confirmation
- ❌ Execute trades
- ❌ Access screenshots without explicit permission
- ❌ Bypass RLS policies

## Future Provider Integration

### Adding a New Provider

1. Create provider class implementing `AIProvider` interface
2. Register in provider registry
3. Add configuration UI
4. Test with mock data first

### Example: OpenAI Provider

```typescript
class OpenAIProvider implements AIProvider {
  async generateText(prompt: string): Promise<AIResponse<string>> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return {
      data: data.choices[0].message.content,
      usage: data.usage
    };
  }
}
```

## Testing

### Unit Tests

```bash
npm run test
```

Tests cover:
- Query validation
- Mock provider behavior
- Context building
- Security checks

### Manual Testing

1. Start development server: `npm run dev`
2. Navigate to AI features (when implemented)
3. Mock provider will respond automatically
4. No API key required

## Cost Control

### Built-in Limits
- Max context size per feature
- Max output size per feature
- Request rate limiting (future)
- Token budget tracking (future)

### Recommendations
- Use caching for repeated queries
- Minimize context size
- Use smaller models for simple tasks
- Monitor usage in production

## Migration Path

### Phase 1 (Current)
- ✅ Architecture foundation
- ✅ Mock provider
- ✅ Query DSL
- ✅ Validation
- ✅ Context builder
- ✅ Security model

### Phase 2 (Future)
- Real provider integration (OpenAI/Qwen)
- AI Query UI
- Server-side API boundary
- Usage tracking

### Phase 3 (Future)
- AI Trade Review
- AI Auto-Tagging
- AI Weekly/Monthly Reports
- Pattern Analysis

### Phase 4 (Future)
- AI Chart Generation
- Advanced Analytics
- Predictive Insights

## FAQ

### Q: Does the app work without an AI API key?
**A:** Yes! The Mock Provider is used by default. All features work without a real AI provider.

### Q: Is my trading data sent to AI providers?
**A:** Only if you configure a real provider AND enable AI features. Even then, data is sanitized and minimized.

### Q: Can AI modify my trades automatically?
**A:** No. AI can only suggest changes. You must explicitly approve any modifications.

### Q: What if I want to use a different AI provider?
**A:** The architecture is provider-agnostic. You can switch providers by updating the configuration.

### Q: Is this secure?
**A:** Yes. AI cannot bypass RLS, cannot access other users' data, and cannot execute arbitrary code.

## Conclusion

This AI architecture provides a safe, flexible foundation for future AI features while maintaining security, privacy, and cost-effectiveness. The mock provider allows development and testing without external dependencies, and the provider abstraction enables easy integration with any AI service in the future.
