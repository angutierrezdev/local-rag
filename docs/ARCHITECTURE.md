# Local RAG System - Architecture & Refactoring Guide

## Current State Assessment

**Overall Health Score:** 6.2/10  
**Status:** ⚠️ Architecture debt identified with critical violations  
**Key Issues:** Framework coupling, mixed responsibilities, missing domain layer, untestable code

---

## SOLID Principles Analysis

| Principle | Score | Status | Issue |
|-----------|-------|--------|-------|
| **SRP** (Single Responsibility) | 5/10 | ❌ Violated | main() has 8+ responsibilities, ConfigService mixes 5 concerns, vector.ts has 7+ |
| **OCP** (Open/Closed) | 5/10 | ❌ Violated | Switch statement for document loaders, hardcoded config sections |
| **LSP** (Liskov Substitution) | 9/10 | ✅ Good | PatchedChroma properly extends base class |
| **ISP** (Interface Segregation) | 7/10 | ⚠️ Acceptable | AppConfig forces depending on entire config structure |
| **DIP** (Dependency Inversion) | 4/10 | ❌ Violated | Direct imports of Ollama, readline, InMemoryChatMessageHistory in main.ts |

---

## Critical Violations (MUST FIX FIRST)

### 🔴 Priority 1: main.ts (Health: 2.0/10)
**DIP & SRP Critical**
- Direct concrete imports: Ollama, readline, InMemoryChatMessageHistory
- 8+ distinct responsibilities in main() function
- Impossible to unit test
- Cannot swap LLM providers without rewriting entire file

**Refactoring Effort:** 8-12 hours  
**Approach:** Dependency injection + service factories

### 🔴 Priority 2: config.ts (Health: 3.5/10)
**SRP & DIP High**
- Handles: env loading, JSON parsing, validation, defaults, singleton management
- Singleton pattern blocks all unit testing (global state)
- ConfigService coupled to entire codebase
- Hard to extend with new configuration sources

**Refactoring Effort:** 6-8 hours  
**Approach:** Extract into focused classes (EnvVarProvider, JsonConfigLoader, Validators)

### 🔴 Priority 3: vector.ts (Health: 4.0/10)
**SRP & DIP High**
- getRetriever() function has 7+ concerns: config loading, path management, validation, document loading, collection naming, vector store initialization, retriever creation
- 100+ lines with mixed logic
- Cannot test individual responsibilities

**Refactoring Effort:** 8-10 hours  
**Approach:** Extract into domain services + gateway adapters

---

## Target Architecture

```
┌────────────────────────────────────────────────────────┐
│              DOMAIN LAYER                              │
│     (Pure business logic, no frameworks)               │
├────────────────────────────────────────────────────────┤
│  Entities: Question, RagResponse, DocumentCollection   │
│  Value Objects: ClientId, EmbeddingScore               │
│  Domain Services: QuestionValidator, MultiTenancyPolicy│
└────────────────────────────────────────────────────────┘
                           △
┌────────────────────────────────────────────────────────┐
│           APPLICATION LAYER                            │
│     (Use cases, orchestration, abstractions)           │
├────────────────────────────────────────────────────────┤
│  Use Cases: AskQuestionUseCase, IngestDocumentsUseCase │
│  Ports (Interfaces): ILanguageModel, IVectorStore, etc │
│  DTOs: Request/Response objects                        │
└────────────────────────────────────────────────────────┘
                           △
┌────────────────────────────────────────────────────────┐
│        INTERFACE ADAPTERS LAYER                        │
│     (Framework integration, dependency injection)      │
├────────────────────────────────────────────────────────┤
│  Controllers: CliController, WatcherController         │
│  Gateways: OllamaLLMGateway, ChromaVectorGateway, etc │
│  Factories: RagServiceFactory (DI container)           │
└────────────────────────────────────────────────────────┘
                           △
┌────────────────────────────────────────────────────────┐
│    FRAMEWORKS & EXTERNAL LIBRARIES                     │
│   (Ollama, ChromaDB, readline, chokidar, etc)         │
└────────────────────────────────────────────────────────┘
```

---

## Refactoring Roadmap (5 Phases, ~22 days total)

### Phase 1: Dependency Injection (DIP) - Days 1-4
**Focus:** Fix main.ts, unblock unit testing

**Create:**
- `src/abstractions/interfaces.ts` - ILanguageModel, IMessageHistoryProvider, IInputValidator, etc.
- `src/services/OllamaLanguageModel.ts` - Implements ILanguageModel
- `src/services/InMemoryMessageHistoryProvider.ts` - Implements IMessageHistoryProvider
- `src/services/DefaultInputValidator.ts`, `DefaultInputSanitizer.ts`, `ReadlineUserInputHandler.ts`
- `src/factories/RagServiceFactory.ts` - DI container

**Refactor:**
- `src/main.ts` - Inject dependencies instead of creating them directly

**Outcome:** Can unit test services, can swap implementations

**Effort:** 8-12 hours

---

### Phase 2: Service Decomposition (SRP) - Days 5-8
**Focus:** Break down monolithic classes

**Create:**
- `src/infrastructure/config/ConfigLoader.ts` - Pure function to load config
- `src/infrastructure/config/EnvVarProvider.ts` - Environment variable handling
- `src/infrastructure/config/Validators/` - Separate validators per section
- `src/adapters/gateways/` - Implementation gateways for all ports

**Refactor:**
- Decompose `config.ts` ConfigService
- Extract logic from `vector.ts` into focused classes

**Outcome:** Each class has single responsibility, easier to maintain

**Effort:** 8-12 hours

---

### Phase 3: Domain Layer Creation - Days 9-12
**Focus:** Extract business logic into pure domain objects

**Create:**
- `src/domain/entities/Question.ts` - Question validation logic
- `src/domain/entities/RagResponse.ts` - Answer + sources bundling
- `src/domain/entities/DocumentCollection.ts` - Collection management
- `src/domain/value-objects/ClientId.ts` - Type-safe client identifier
- `src/domain/value-objects/EmbeddingScore.ts` - Embedding score with range validation
- `src/domain/domain-services/QuestionValidator.ts` - Question validation rules
- `src/domain/domain-services/MultiTenancyPolicy.ts` - Collection naming rules
- `src/domain/domain-services/DocumentIngestionPolicy.ts` - File type + size rules

**Outcome:** Testable, reusable domain logic independent of frameworks

**Effort:** 6-8 hours

---

### Phase 4: Application Use Cases - Days 13-16
**Focus:** Orchestration layer with dependency injection

**Create:**
- `src/application/use-cases/AskQuestionUseCase.ts` - Question answering orchestration
- `src/application/use-cases/IngestDocumentsUseCase.ts` - Document ingestion orchestration
- `src/application/use-cases/ClearHistoryUseCase.ts` - History clearing
- `src/application/dto/` - Request/Response DTOs

**Refactor:**
- Extract use case logic from `main.ts` and `watcher.ts`

**Outcome:** Can test orchestration with mocked dependencies

**Effort:** 6-8 hours

---

### Phase 5: Testing & Integration - Days 17-22
**Focus:** Unit tests + integration tests, cleanup

**Create:**
- Unit tests for domain layer (~80% coverage)
- Unit tests for use cases (~80% coverage)
- Unit tests for adapters (~70% coverage with mocked frameworks)
- Integration tests for main flows

**Refactor:**
- Simplify entry points (`main.ts`, `watcher.ts`) to 20 lines each
- Create clean setup entry point for vector DB initialization

**Outcome:** Comprehensive test coverage, maintainable codebase

**Effort:** 6-8 hours

---

## Quick Wins (Do First)

### 1. Extract Document Loaders to Strategy Pattern (2 hours)

**Current Problem:** Switch statement in `loadDocuments()` forces modification to add new formats

**Solution:** Registry pattern for loaders
```typescript
// Create interface
interface IDocumentLoaderStrategy {
  canHandle(fileType: string): boolean;
  load(filePath: string): Promise<Document[]>;
}

// Create registry
class DocumentLoaderRegistry {
  private strategies: Map<string, IDocumentLoaderStrategy> = new Map();
  register(strategy: IDocumentLoaderStrategy) { /* ... */ }
  load(filePath: string): Promise<Document[]> { /* ... */ }
}

// Now adding .txt support requires zero code changes:
registry.register(new TxtDocumentLoader());
```

**Benefit:** OCP compliance, extensible design

---

### 2. Extract Configuration Loading from ConfigService (3 hours)

**Current Problem:** ConfigService is a singleton with 5+ responsibilities

**Solution:** Pure functions + focused classes
```typescript
// Pure function
function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    ollama: OllamaConfigValidator.validate(env),
    /* ... */
  };
}

// Use with dependency injection
class EnvConfigGateway implements IConfiguration {
  constructor(private config: AppConfig) {}
  getOllamaBaseUrl() { return this.config.ollama.baseUrl; }
}
```

**Benefit:** Testable, no global state

---

## Testing Strategy

After refactoring, testing becomes straightforward:

```typescript
// ✅ Test domain logic in isolation
const validator = new QuestionValidator();
expect(validator.validate("test")).toBe(true);

// ✅ Test use cases with mocks
const mockLLM = { invoke: jest.fn().mockResolvedValue("answer") };
const useCase = new AskQuestionUseCase(mockLLM, mockVector, mockHistory);
const result = await useCase.execute({ question: "test" });

// ✅ Test adapters with jest.mock
jest.mock("@langchain/ollama");
const gateway = new OllamaLLMGateway(config);
```

---

## Files to Keep/Remove

### Keep (Refactor In-Place)
- `src/validation.ts` - Good validation logic, keep as pure functions
- `src/types.ts` - Type definitions, refine as needed
- `src/main.ts` - Will become 20-line entry point
- `src/config.ts` - Will be decomposed
- `src/vector.ts` - Will be decomposed
- `src/watcher.ts` - Will become 20-line entry point

### Create New
- `src/domain/` - Domain layer (entities, value objects, domain services)
- `src/application/` - Use cases, ports, DTOs
- `src/adapters/` - Controllers, gateways, factories
- `src/infrastructure/` - Config loaders, validators, utilities

### Remove/Archive
- All doc files (consolidate into this single file)
- Any legacy code not integrated into new architecture

---

## Execution Priority

**If only 5-10 days:**
- Do Phase 1 (DIP) only - highest impact, unblocks testing

**If only 10-15 days:**
- Do Phases 1-2 (DIP + SRP) - covers critical violations

**If 20+ days:**
- Do all phases - complete clean architecture

**Hidden benefit:** Phases 2-3 overlap heavily, actual time is ~18-20 days not 22

---

## Key Metrics

### Before
- Cyclomatic complexity: main() = 12-15, getConfig() = 7-8, getRetriever() = 10+
- Testability: ~20% of code testable
- Code reusability: Low (entangled concerns)

### After (Target)
- Cyclomatic complexity: All functions < 5
- Testability: 80%+ of code testable
- Code reusability: High (isolated concerns)

---

## Code Examples

### DIP: Before vs After

```typescript
// ❌ BEFORE: Concrete dependencies
async function main() {
  const model = new Ollama(config.ollama);
  const history = new InMemoryChatMessageHistory();
  const rl = readline.createInterface({...});
  // ... 100+ lines
}

// ✅ AFTER: Dependency injection
async function main() {
  const factory = new RagServiceFactory();
  const { controller, presenter } = await factory.createCliServices();
  await controller.run();
}
```

### SRP: Before vs After

```typescript
// ❌ BEFORE: ConfigService does everything
class ConfigService {
  getConfig() {
    // 1. Load env vars
    // 2. Parse JSON
    // 3. Validate all sections
    // 4. Handle defaults
    // 5. Return merged config
  }
}

// ✅ AFTER: Focused classes
class EnvVarProvider {
  getRequired(key: string): string { /* ... */ }
}

class JsonConfigLoader {
  loadPromptsConfig(path: string): PromptsConfig { /* ... */ }
}

class ConfigBuilder {
  build(): AppConfig {
    const env = this.envProvider.getRequired("OLLAMA_BASE_URL");
    const prompts = this.jsonLoader.loadPromptsConfig(path);
    return { ollama: { baseUrl: env }, prompts };
  }
}
```

### OCP: Before vs After

```typescript
// ❌ BEFORE: Switch statement requires modification
export async function loadDocuments(filePath: string): Promise<Document[]> {
  const ext = getFileExtension(filePath);
  switch (ext) {
    case "csv": return loadCsv(filePath);
    case "pdf": return loadPdf(filePath);
    // Adding .txt requires modifying this file
  }
}

// ✅ AFTER: Registry pattern, extensible
class DocumentLoaderRegistry {
  private strategies = new Map<string, IDocumentLoaderStrategy>();

  load(filePath: string): Promise<Document[]> {
    const ext = getFileExtension(filePath);
    const loader = this.strategies.get(ext);
    if (!loader) throw new Error(`No loader for ${ext}`);
    return loader.load(filePath);
  }
}

// Adding .txt requires ZERO code changes:
const registry = new DocumentLoaderRegistry();
registry.register(new CsvLoader(), "csv");
registry.register(new PdfLoader(), "pdf");
registry.register(new TxtLoader(), "txt"); // NEW
```

---

## Summary

This system needs **refactoring before adding features**. Current architecture prevents testing and extension. The 5-phase approach addresses violations in order of impact: DIP → SRP → OCP. Most critical: **Phase 1 (DIP) unlocks unit testing**, enabling confidence in subsequent phases.

**Recommendation:** Start with Phase 1 (4 days) to unblock testing, then reassess timeline for remaining phases.
