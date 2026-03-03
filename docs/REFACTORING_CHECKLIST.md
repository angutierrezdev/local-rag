# Clean Architecture Refactoring Checklist

## Phase 1: Foundation (5-7 days)

### Domain Layer - Entities
- [ ] Create `src/domain/entities/Question.ts`
  - [ ] Validate question length (0, > 5000)
  - [ ] Remove injection patterns in constructor
  - [ ] Immutable, with getters
  - [ ] Unit tests

- [ ] Create `src/domain/entities/RagResponse.ts`
  - [ ] Bundle answer + source documents
  - [ ] Immutable value object
  - [ ] Unit tests

- [ ] Create `src/domain/entities/DocumentCollection.ts`
  - [ ] Handle document grouping by client
  - [ ] Multi-tenancy validation
  - [ ] Unit tests

### Domain Layer - Value Objects
- [ ] Create `src/domain/value-objects/ClientId.ts`
  - [ ] Validate non-empty
  - [ ] Type-safe wrapper around string

- [ ] Create `src/domain/value-objects/EmbeddingScore.ts`
  - [ ] Ensure 0-1 range
  - [ ] Comparable/sortable

### Domain Layer - Domain Services
- [ ] Create `src/domain/domain-services/QuestionValidator.ts`
  - [ ] Extract validation logic from `validation.ts`
  - [ ] Returns domain errors, not strings

- [ ] Create `src/domain/domain-services/MultiTenancyPolicy.ts`
  - [ ] Collection naming rules
  - [ ] Isolation rules

- [ ] Create `src/domain/domain-services/DocumentIngestionPolicy.ts`
  - [ ] Supported file types
  - [ ] Max file size rules

### Application Layer - Ports (Interfaces)
- [ ] Create `src/application/ports/ILanguageModel.ts`
  - [ ] `invoke(prompt, context): Promise<string>`
  - [ ] `supportsStreaming(): boolean`

- [ ] Create `src/application/ports/IVectorStore.ts`
  - [ ] `search(query, limit?): Promise<Document[]>`
  - [ ] `addDocuments(docs): Promise<void>`

- [ ] Create `src/application/ports/IEmbeddings.ts`
  - [ ] `embed(text): Promise<number[]>`

- [ ] Create `src/application/ports/IMessageHistory.ts`
  - [ ] `add(role, content): Promise<void>`
  - [ ] `get(): Promise<Message[]>`
  - [ ] `clear(): Promise<void>`

- [ ] Create `src/application/ports/IDocumentLoader.ts`
  - [ ] `load(filePath): Promise<Document[]>`

- [ ] Create `src/application/ports/IConfiguration.ts`
  - [ ] `getOllamaBaseUrl(): string`
  - [ ] `getOllamaModel(): string`
  - [ ] `getChromaUrl(): string`
  - [ ] etc.

- [ ] Create `src/application/ports/ILogger.ts`
  - [ ] `debug(msg): void`
  - [ ] `info(msg): void`
  - [ ] `warn(msg): void`
  - [ ] `error(msg): void`

- [ ] Create `src/application/ports/IPresenter.ts`
  - [ ] `format(response): string`

### Application Layer - Use Cases
- [ ] Create `src/application/use-cases/AskQuestionUseCase.ts`
  - [ ] Inject all dependencies via constructor
  - [ ] `execute(request): Promise<response>`
  - [ ] No framework code
  - [ ] Unit tests with mocked dependencies

- [ ] Create `src/application/use-cases/IngestDocumentsUseCase.ts`
  - [ ] `execute(filePath, clientId): Promise<collectionMetadata>`
  - [ ] Uses document loader → vector store
  - [ ] Unit tests

- [ ] Create `src/application/use-cases/ClearHistoryUseCase.ts`
  - [ ] `execute(sessionId): Promise<void>`

### Application Layer - DTOs
- [ ] Create `src/application/dto/AskQuestionRequest.ts`
- [ ] Create `src/application/dto/AskQuestionResponse.ts`
- [ ] Create `src/application/dto/IngestRequest.ts`
- [ ] Create `src/application/dto/IngestResponse.ts`

---

## Phase 2: Adapters (5-7 days)

### Gateway Adapters - LLM
- [ ] Create `src/adapters/gateways/OllamaLLMGateway.ts`
  - [ ] Implements `ILanguageModel`
  - [ ] Wraps LangChain Ollama client
  - [ ] Unit tests with jest.mock()

### Gateway Adapters - Vector Store
- [ ] Create `src/adapters/gateways/ChromaVectorGateway.ts`
  - [ ] Implements `IVectorStore`
  - [ ] Wraps Chroma client
  - [ ] Handles collection creation/lookup

### Gateway Adapters - Embeddings
- [ ] Create `src/adapters/gateways/OllamaEmbeddingsGateway.ts`
  - [ ] Implements `IEmbeddings`
  - [ ] Wraps LangChain OllamaEmbeddings

### Gateway Adapters - History
- [ ] Create `src/adapters/gateways/InMemoryHistoryGateway.ts`
  - [ ] Implements `IMessageHistory`
  - [ ] Wraps LangChain InMemoryChatMessageHistory

### Gateway Adapters - Document Loading
- [ ] Create `src/adapters/gateways/DocumentLoaderGateway.ts`
  - [ ] Implements `IDocumentLoader`
  - [ ] Delegates to documentLoader.ts loaders

### Configuration Adapter
- [ ] Create `src/infrastructure/config/ConfigLoader.ts`
  - [ ] Pure function: `loadConfig(env) → AppConfig`
  - [ ] Add Zod schema for validation

- [ ] Create `src/adapters/gateways/EnvConfigGateway.ts`
  - [ ] Implements `IConfiguration`
  - [ ] Calls ConfigLoader in constructor
  - [ ] Remove singleton pattern

### Logging Adapter
- [ ] Create `src/adapters/gateways/ConsoleLoggerGateway.ts`
  - [ ] Implements `ILogger`
  - [ ] Simple console output with levels

### Controllers
- [ ] Create `src/adapters/controllers/CliController.ts`
  - [ ] Constructor: inject use cases + presenter
  - [ ] `handleUserInput(input): Promise<void>`
  - [ ] Calls `AskQuestionUseCase.execute()`
  - [ ] Uses presenter to format output

- [ ] Create `src/adapters/controllers/WatcherController.ts`
  - [ ] Constructor: inject `IngestDocumentsUseCase`
  - [ ] `handleFileAdded(filePath, clientId): Promise<void>`
  - [ ] Triggers ingestion with queue

- [ ] Create `src/adapters/controllers/BaseController.ts`
  - [ ] Common error handling
  - [ ] Common logging patterns

### Presenters  
- [ ] Create `src/adapters/presenters/ConsolePresenter.ts`
  - [ ] Implements `IPresenter`
  - [ ] Formats `RagResponse` for CLI output

---

## Phase 3: Integration (3-4 days)

### Dependency Injection
- [ ] Create `src/infrastructure/di/Container.ts`
  - [ ] `static create(env): Container`
  - [ ] Register all gateways
  - [ ] Register all use cases
  - [ ] `get<T>(key): T`
  
- [ ] Create `src/infrastructure/di/bindings.ts` (optional, for readability)
  - [ ] Export all binding keys as constants

### Infrastructure Utilities
- [ ] Create `src/infrastructure/validation/InputValidator.ts`
  - [ ] Move logic from `validation.ts`
  - [ ] Keep pure functions

- [ ] Move document loaders to `src/infrastructure/loaders/`
  - [ ] Keep existing loader logic
  - [ ] Create factory pattern

### Entry Points - Minimal
- [ ] Rewrite `src/main.ts` (15-20 lines)
  - [ ] Create DI container
  - [ ] Get CliController from container
  - [ ] Run controller loop
  - [ ] Error handling only

- [ ] Rewrite `src/watcher.ts` (15-20 lines)
  - [ ] Create DI container
  - [ ] Get WatcherController from container
  - [ ] Start chokidar listener
  - [ ] Delegate to controller

- [ ] Create `src/setup.ts` (15-20 lines)
  - [ ] One-time vector DB setup
  - [ ] Create DI container
  - [ ] Get IngestDocumentsUseCase
  - [ ] Execute with CLI file path

---

## Phase 4: Testing (5-7 days)

### Domain Tests
- [ ] `src/domain/entities/__tests__/Question.test.ts`
- [ ] `src/domain/entities/__tests__/RagResponse.test.ts`
- [ ] `src/domain/entities/__tests__/DocumentCollection.test.ts`
- [ ] `src/domain/value-objects/__tests__/ClientId.test.ts`
- [ ] `src/domain/value-objects/__tests__/EmbeddingScore.test.ts`
- [ ] `src/domain/domain-services/__tests__/*.test.ts`

### Use Case Tests
- [ ] `src/application/use-cases/__tests__/AskQuestionUseCase.test.ts`
  - [ ] Mock all dependencies (ports)
  - [ ] Test happy path
  - [ ] Test error cases
  - [ ] Test domain validation

- [ ] `src/application/use-cases/__tests__/IngestDocumentsUseCase.test.ts`
- [ ] `src/application/use-cases/__tests__/ClearHistoryUseCase.test.ts`

### Adapter Tests
- [ ] `src/adapters/gateways/__tests__/OllamaLLMGateway.test.ts`
  - [ ] Mock LangChain Ollama
  - [ ] Test invoke() method

- [ ] `src/adapters/gateways/__tests__/ChromaVectorGateway.test.ts`
  - [ ] Mock ChromaDB client
  - [ ] Test search(), addDocuments()

- [ ] `src/adapters/controllers/__tests__/CliController.test.ts`
  - [ ] Mock use cases
  - [ ] Test input handling

### Integration Tests
- [ ] `src/infrastructure/di/__tests__/Container.test.ts`
  - [ ] Verify all bindings resolve
  - [ ] Verify use cases get correct dependencies

- [ ] `src/__tests__/e2e.test.ts` (if desired)
  - [ ] Real LLM call to local Ollama
  - [ ] Real vector store call
  - [ ] Real document loading

### Coverage Targets
- [ ] Domain: 95%+
- [ ] Use Cases: 90%+
- [ ] Adapters: 80%+
- [ ] Infrastructure: 85%+
- [ ] **Overall: 85%+**

---

## Phase 5: Cleanup & Documentation

### Code Cleanup
- [ ] Delete old `src/config.ts` (replaced by gateways + ConfigLoader)
- [ ] Delete old `src/vector.ts` (logic moved to gateways + use cases)
- [ ] Delete old `src/watcher.ts` (logic moved to controller)
- [ ] Verify all imports updated to new paths
- [ ] Remove unused dependencies from package.json

### Documentation
- [ ] Update README with new architecture overview
- [ ] Create ARCHITECTURE.md with layer diagrams
- [ ] Document all ports/interfaces
- [ ] Create TESTING.md with test strategy
- [ ] Document dependency injection setup
- [ ] Create MIGRATION_GUIDE.md for team

### Development Setup
- [ ] Add pre-commit hooks for tests
- [ ] Add GitHub Actions workflow for CI
- [ ] Configure Jest coverage thresholds
- [ ] Setup storybook (optional, for UI adapters)

---

## Post-Refactoring Verification

### Architecture Checks
- [ ] [ ] No imports from `src/main.ts` in domain/
- [ ] [ ] No imports from `src/main.ts` in application/
- [ ] [ ] No direct framework imports in domain/
- [ ] [ ] No direct framework imports in application/
- [ ] [ ] All external dependencies behind IPort interfaces
- [ ] [ ] No circular dependencies (run dependency-cruiser)
- [ ] [ ] No singleton patterns (except global app container)

### Quality Checks
- [ ] [ ] Test coverage ≥ 85%
- [ ] [ ] No unused imports
- [ ] [ ] No console.log() in production code
- [ ] [ ] All errors have proper types
- [ ] [ ] TypeScript strict mode enabled
- [ ] [ ] ESLint passing (0 warnings)

### Functional Checks
- [ ] [ ] `npm start` works identically to before
- [ ] [ ] `npm run watch` works identically to before
- [ ] [ ] `npm run setup-vector` works identically to before
- [ ] [ ] All tests pass
- [ ] [ ] RAG system responds to questions
- [ ] [ ] File watcher triggers ingestion
- [ ] [ ] Chat history persists in session

---

## Estimated Effort Breakdown

| Phase | Task | Days | Notes |
|-------|------|------|-------|
| 1 | Domain entities (3) | 2 | Include unit tests |
| 1 | Port interfaces (7) | 1.5 | Straightforward definitions |
| 1 | Use cases (3) + DTOs | 2.5 | Most complex part |
| 1 | **Subtotal** | **6** | Foundation complete |
| 2 | Gateway adapters (6) | 3.5 | Wrap existing code |
| 2 | Controllers (2) | 1.5 | Thin orchestration layer |
| 2 | **Subtotal** | **5** | Framework integration done |
| 3 | DI Container | 1.5 | Straightforward wiring |
| 3 | Entry points (3) | 1 | Minimal code |
| 3 | **Subtotal** | **2.5** | Integration complete |
| 4 | Unit tests (20+ files) | 5 | Bulk of test writing |
| 4 | Integration tests | 1 | DI verification |
| 4 | **Subtotal** | **6** | Comprehensive coverage |
| 5 | Cleanup & docs | 3 | Final polish |
| 5 | **Subtotal** | **3** | Production ready |
| **TOTAL** | | **22.5** | ~25 days realistic |

---

## Risk Mitigation

### Risk: Breaking Existing Functionality
- **Mitigation**: Keep old code during Phase 1-3, verify tests pass before deletion
- **Testing**: Integration tests against real Ollama + Chroma
- **Rollback**: Git branches per phase, easy to revert

### Risk: Budget Overrun  
- **Mitigation**: Strict time-boxing per task, prioritize Phase 1-3
- **Simplification**: Skip "nice to have" adapters (REST API, etc.) in first pass
- **Parallelization**: Domain + adapter development can overlap slightly

### Risk: Team Adoption
- **Mitigation**: Documentation-heavy, inline code comments
- **Training**: Pair programming sessions for architecture walkthrough
- **Safety**: Comprehensive tests reduce fear of refactoring

