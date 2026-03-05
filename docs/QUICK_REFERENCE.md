# SOLID Refactoring - Quick Reference & Visuals

## 1. Violation Severity Matrix

```
CRITICAL (MUST FIX) - 80% of effort should go here

Priority 1.1: main.ts (2.0/10 health)
  ❌ DIP: Direct Ollama, readline, InMemoryChatMessageHistory imports
  ❌ SRP: 8+ distinct responsibilities in main() function
  Impact: BLOCKS all unit testing
  Effort: 8-12 hours (Phase 1)

Priority 1.2: config.ts (3.5/10 health)
  ❌ SRP: Handles env, JSON parsing, validation, defaults all mixed
  ❌ DIP: Direct file system dependency (readFileSync)
  ❌ Singleton pattern prevents testing
  Impact: BLOCKS multiple config sources & testing
  Effort: 6-8 hours (Phase 1-2)

Priority 1.3: vector.ts (4.0/10 health)
  ❌ SRP: getRetriever() = 100 lines with 7+ concerns
  ❌ DIP: Direct OllamaEmbeddings dependency
  Impact: BLOCKS LLM/embedding provider switching
  Effort: 8-10 hours (Phase 1-2)


HIGH (SHOULD FIX) - 15% of effort

Priority 2.1: documentLoader.ts (5.5/10 health)
  ⚠️ OCP: Switch statement closed to new file formats
  Impact: Adding Markdown requires code modification
  Effort: 4-5 hours (Phase 3)

Priority 2.2: watcher.ts (6.5/10 health)
  ⚠️ SRP: Queue + processing mixed
  ⚠️ DIP: Direct getRetriever() call
  Impact: Cannot test queue independently
  Effort: 3-4 hours (Phase 2)

Priority 2.3: validation.ts (7.0/10 health)
  ⚠️ ISP: All validations in one module
  Impact: Clients import more than needed
  Effort: 2-3 hours (Phase 3)


POLISH (OPTIONAL) - 5% of effort

Priority 3.1: types.ts (8.0/10 health)
  ⚠️ ISP: AppConfig requires entire config for one function
  Impact: Unclear function dependencies
  Effort: 1 hour (Phase 5)
```

---

## 2. Dependency Graph (Current vs. Future)

### CURRENT STATE (Tightly Coupled)
```
┌─────────────────────────────────────────────────────────┐
│   EXTERNAL FRAMEWORKS                                    │
│   (LangChain, ChromaDB, readline, pdf-parse, etc.)      │
└─────────────────────────────────────────────────────────┘
    ▲        ▲         ▲         ▲          ▲        ▲
    │        │         │         │          │        │
    │        └─────┬───┴─────┬───┴──────┬───┴──┐     │
    │              │         │          │      │     │
   │               ▼         ▼          ▼      ▼     ▼
┌──┴───────────────────────────────────────────────────────┐
│                 APPLICATION LOGIC                        │
│  (No clear layers, everything at same level)            │
│                                                          │
│  main.ts ◄─── config.ts ◄─── vector.ts ◄─── watcher.ts │
│    │              │              │              │       │
│    └──────────────┴──────────────┴──────────────┘       │
│                (All tightly coupled)                     │
└────────────────────────────────────────────────────────┘

Problem: Dependencies flow OUTWARD to frameworks
```

### DESIRED STATE (Clean Architecture)
```
┌─────────────────────────────────────────────────────┐
│ APPLICATION LAYER (Use Cases, Entities)             │
│ ✓ No framework knowledge                            │
│ ✓ Can be unit tested without frameworks             │
│ ✓ Pure business logic                               │
└─────────────────────────────────────────────────────┘
                       ▲
                       │
                   (implements)
                       │
┌─────────────────────────────────────────────────────┐
│ ADAPTER LAYER (Controllers, Presenters, Gateways)  │
│ ✓ Framework integration here                        │
│ ✓ Implements port interfaces                        │
│ ✓ Thin layer, mostly delegation                     │
└─────────────────────────────────────────────────────┘
                       │
                   (uses)
                       ▼
┌─────────────────────────────────────────────────────┐
│ FRAMEWORKS & EXTERNAL LIBRARIES                     │
│ ✓ Only accessed through adapters                    │
│ ✓ Can be swapped out                                │
│ ✓ Implementation detail                             │
└─────────────────────────────────────────────────────┘

Problem Solved: Dependencies flow INWARD to application
```

---

## 3. What Each Principle Controls

```
DIP (Dependency Inversion) - WHO provides what
    "Depend on abstractions, not concrete implementations"
    
    Problem in main.ts:
    const model = new Ollama(...)  ← Direct dependency
    
    Solution:
    const model = factory.createLanguageModel(...)  ← Abstract interface

    Impact: Enable swapping Ollama ↔ OpenAI, testing with mocks


SRP (Single Responsibility) - WHY things change
    "Each class/function should have ONE reason to change"
    
    Problem in main.ts:
    async function main() {  ← Changes if: UI changes, LLM changes, 
      // Chain setup             validation changes, retrieval changes
      // Message history         history changes, input handling changes
      // User interaction        response formatting changes
      // Input validation        error handling changes
      // Input sanitization
      // Vector retrieval
      // Response display
      // Error handling
    }
    
    Solution: Extract each concern into separate class
    
    Impact: Can modify UI without touching LLM logic


OCP (Open/Closed) - HOW to extend without modifying
    "Open for extension, closed for modification"
    
    Problem in documentLoader.ts:
    switch (fileType) {
      case "csv": ...
      case "pdf": ...
      case "docx": ...
      // TO ADD MARKDOWN: Must modify this switch statement
    }
    
    Solution: DocumentLoaderRegistry with strategy pattern
    registry.register("md", new MarkdownLoader())
    // ← NO existing code modified
    
    Impact: Add file formats without risk of breaking existing ones


ISP (Interface Segregation) - WHAT clients actually need
    "Clients shouldn't depend on interfaces they don't use"
    
    Problem in AppConfig:
    function getRetriever(filePath, clientId) {
      const config = configService.getConfig();
      // ↓ Gets ALL properties (8+ properties)
      // But only uses: embeddings, chroma, csv, debug
      // Depends on properties it doesn't need!
    }
    
    Solution: Create focused interfaces
    interface RetrieverConfig { embeddings, chroma, csv, debug }
    function getRetriever(config: RetrieverConfig) { }
    
    Impact: Clearer code, easier to mock, decouple config shape

```

---

## 4. Critical Path (Execution Order)

```
START HERE (Day 1)
         │
         ▼
    ┌─────────────────────────────────────┐
    │ Phase 1: DIP (Dependency Injection) │
    │ Duration: 3-4 days                  │
    │ Goal: Create abstractions            │
    │                                     │
    │ .getAbs main.ts                      │
    │ · Create ILanguageModel              │
    │ · Create IMessageHistoryProvider     │
    │ · Create IInputValidator             │
    │ · Create service implementations     │
    │ · Create factory classes             │
    │                                     │
    │ → Unblocks: All unit testing        │
    │ → Risk: LOW                         │
    └─────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ Phase 2: SRP (Extract Services)     │
    │ Duration: 3-4 days                  │
    │ Goal: One responsibility per class   │
    │                                     │
    │ · ConfigService → Providers+Builder │
    │ · getRetriever() → RetrieverFactory │
    │ · watcher → IngestionQueue+Proc.   │
    │                                     │
    │ → Unblocks: Better maintainability │
    │ → Risk: LOW (leverages Phase 1)    │
    └─────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ Phase 3: OCP (Strategy Patterns)    │
    │ Duration: 2-3 days                  │
    │ Goal: Add features without modifying │
    │                                     │
    │ · DocumentLoaderRegistry            │
    │ · Validation interfaces             │
    │ · Config provider registry          │
    │                                     │
    │ → Unblocks: Easy extensibility     │
    │ → Risk: LOW (builds on 1-2)        │
    └─────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ Phase 4: Testing (20+ test files)   │
    │ Duration: 5-6 days                  │
    │ Goal: 85%+ coverage                 │
    │                                     │
    │ · Domain unit tests                 │
    │ · Use case integration tests        │
    │ · Adapter tests                     │
    │                                     │
    │ → Confidence: High                  │
    │ → Risk: MEDIUM                      │
    └─────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ Phase 5: Cleanup & Documentation    │
    │ Duration: 3-4 days                  │
    │ Goal: Production ready              │
    │                                     │
    │ · Delete old code                   │
    │ · Update imports                    │
    │ · Write ARCHITECTURE.md             │
    │ · Write TESTING.md                  │
    │                                     │
    │ → Result: Clean codebase            │
    │ → Risk: LOW                         │
    └─────────────────────────────────────┘
         │
         ▼
     DONE (Day 22-25)

Total: 22-25 days
```

---

## 5. Budget Decision Tree

```
┌─ How much time do we have?
│
├─ SHORT (5-10 days)
│   └─ Focus on Phase 1 (DIP) only
│       └─ Unblocks unit testing
│       └─ Most critical, highest impact
│       └─ Skip Phases 2-5 for now
│       └─ Result: Testable (partial improvement)
│
├─ MEDIUM (12-15 days)
│   └─ Phases 1-2 + Quick Tests
│       └─ DIP (4 days) + SRP (4 days) + Testing basics (4-5 days)
│       └─ Skip Phase 3 (OCP) - defer new formats
│       └─ Skip Phase 5 (cleanup)
│       └─ Result: Testable & maintainable
│
└─ FULL (22-25 days)
    └─ All 5 phases
        └─ Complete refactoring
        └─ Comprehensive tests
        └─ Full documentation
        └─ Result: Production-ready clean architecture
```

---

## 6. File-by-File Attack Plan

### PHASE 1 (Days 1-4) - Fix DIP

**Affected Files:**

```typescript
// NEW FILES (create these)
src/abstractions/interfaces.ts       (←← START HERE)
  export interface ILanguageModel { }
  export interface IMessageHistoryProvider { }
  export interface IInputValidator { }
  export interface IInputSanitizer { }
  export interface IUserInputHandler { }
  export interface IEmbeddingProvider { }
  export interface IConfigSource { }

src/services/
  OllamaLanguageModel.ts
  InMemoryHistoryProvider.ts
  DefaultInputValidator.ts
  DefaultInputSanitizer.ts
  ReadlineUserInputHandler.ts
  OllamaEmbeddingProvider.ts
  EnvVarProvider.ts
  JsonConfigLoader.ts

src/factories/
  RagServiceFactory.ts
  DocumentLoaderFactory.ts

// MODIFIED FILES
src/main.ts                          (← Becomes 40 lines)
  - Remove: All concrete imports (Ollama, readline, etc.)
  - Add: DI factory creation
  - Add: Dependency injection
  - Remove: 130+ lines of setup code

// UNCHANGED
src/config.ts                        (← KEEP, will refactor in Phase 2)
src/vector.ts                        (← KEEP, will refactor in Phase 2)
src/watcher.ts                       (← KEEP, will refactor in Phase 2)
```

### PHASE 2 (Days 5-8) - Fix SRP

**Affected Files:**

```typescript
// NEW FILES
src/providers/
  EnvVarProvider.ts
  JsonConfigLoader.ts
  
src/validators/
  OllamaConfigValidator.ts
  ChromaConfigValidator.ts
  CsvConfigValidator.ts
  PromptsConfigValidator.ts

src/utils/
  CollectionNameGenerator.ts
  DocumentPathResolver.ts
  VectorStoreInitializer.ts

src/factories/
  RetrieverFactory.ts              (← Major extraction)

// MODIFIED FILES
src/config.ts                        (← Becomes thin wrapper)
  - Remove: Env loading logic
  - Remove: JSON loading logic
  - Remove: Validation logic
  - Add: Dependency injection of providers
  - Result: ~30 lines instead of 217

src/vector.ts                        (← Simplified)
  - Remove: getRetriever() logic
  - Add: RetrieverFactory import
  - Delegate: getRetriever() → factory.create()
  - Result: ~100 lines instead of 445

src/watcher.ts                       (← Becomes orchestrator)
  - Remove: Queue state management
  - Add: IngestionQueue class
  - Add: QueueProcessor class
  - Result: ~30 lines instead of 182
```

### PHASE 3 (Days 9-11) - Fix OCP

**Affected Files:**

```typescript
// NEW FILES
src/loaders/
  DocumentLoaderRegistry.ts          (← Strategy pattern)
  CsvDocumentLoaderAdapter.ts
  PdfDocumentLoaderAdapter.ts
  DocxDocumentLoaderAdapter.ts
  TxtDocumentLoaderAdapter.ts

// MODIFIED FILES
src/loaders/documentLoader.ts        (← Remove switch statement)
  - Remove: loadDocuments() function
  - Keep: Individual loader functions
  - Add: Registry creation logic
  - Result: Simpler, focused on implementation

src/validation.ts                    (← Add interfaces)
  - Add: Sanitizer interface
  - Add: Validator interface
  - Wrap: Existing functions in classes
  - Keep: Backward compatibility
```

### PHASE 4 (Days 12-16) - Add Tests

**New Test Files:**

```
src/abstractions/__tests__/
  interfaces.test.ts               (← Type validation tests)

src/services/__tests__/
  OllamaLanguageModel.test.ts
  InMemoryHistoryProvider.test.ts
  DefaultInputValidator.test.ts
  DefaultInputSanitizer.test.ts
  ReadlineUserInputHandler.test.ts

src/utils/__tests__/
  CollectionNameGenerator.test.ts   (← Pure function, easy!)
  DocumentPathResolver.test.ts
  VectorStoreInitializer.test.ts

src/factories/__tests__/
  RagServiceFactory.test.ts
  RetrieverFactory.test.ts

src/__tests__/
  integration.test.ts               (← Full flow test)
  e2e.test.ts                       (← Real Ollama + Chroma)
```

### PHASE 5 (Days 17-22) - Cleanup

**Delete These:**
```
DELETE (once Phase 1-4 passing):
  src/config.ts                    (← Replaced by providers + builder)
  
MODIFY:
  src/vector.ts                    (← Thin wrapper, delegates to factory)
  src/watcher.ts                   (← Thin wrapper, delegates to queue)
  src/types.ts                     (← Keep, add focused interfaces)

CREATE DOCS:
  docs/ARCHITECTURE.md             (← Layer diagram)
  docs/DEPENDENCY_INJECTION.md     (← DI pattern)
  docs/TESTING.md                  (← Test strategy)
  docs/MIGRATION_GUIDE.md          (← Team reference)
```

---

## 7. Testing Difficulty Scale

```
EASIER                      HARDER
 │
 │  CollectionNameGenerator.test.ts
 │    └─ Pure function, input → output
 │    └─ No I/O, no framework
 │    └─ 30 minutes to write full test suite
 │
 │  DocumentPathResolver.test.ts
 │    └─ Few dependencies
 │    └─ Mock file system, that's all
 │    └─ 1 hour
 │
 │  InputValidator.test.ts
 │    └─ Testable independently
 │    └─ Mocks only validation framework
 │    └─ 1.5 hours
 │
 │  RetrieverFactory.test.ts
 │    └─ Many dependencies (EmbeddingProvider, ConfigService, etc.)
 │    └─ Must mock 5+ interfaces
 │    └─ 3-4 hours
 │
 │  Integration tests
 │    └─ Real Ollama + Chroma calls
 │    └─ Full setup/teardown
 │    └─ 2-3 hours each
 │
 └─ E2E tests
      └─ Real everything
      └─ Slowest, least reliable
      └─ 4-5 hours per scenario

RECOMMENDATION: Start with pure functions (CollectionNameGenerator),
                then add dependencies progressively
```

---

## 8. One-Page Developer Checklist

### Pre-Refactor
- [ ] All tests passing? `npm test` ✓
- [ ] All code committed? `git status` (clean)
- [ ] Create feature branch: `git checkout -b feat/solid-refactoring`
- [ ] Document current behavior (screenshots, logs)

### Phase 1 (DIP) - Days 1-4
- [ ] Create `src/abstractions/interfaces.ts`
  - [ ] ILanguageModel
  - [ ] IMessageHistoryProvider
  - [ ] IInputValidator
  - [ ] IInputSanitizer
  - [ ] IUserInputHandler
  - [ ] IEmbeddingProvider
  - [ ] IConfigSource
  
- [ ] Create service implementations in `src/services/`
  - [ ] OllamaLanguageModel
  - [ ] InMemoryHistoryProvider
  - [ ] DefaultInputValidator
  - [ ] DefaultInputSanitizer
  - [ ] ReadlineUserInputHandler
  - [ ] OllamaEmbeddingProvider
  
- [ ] Create `src/factories/RagServiceFactory.ts`

- [ ] Update `src/main.ts`
  - [ ] Remove concrete imports
  - [ ] Inject dependencies from factory
  - [ ] Verify `npm start` works

- [ ] Quality gate: Can you unit test LLM behavior with a mock?
  - [ ] YES? → Continue
  - [ ] NO? → Debug Phase 1

- [ ] Commit: `git commit -m "feat: Add DIP abstractions and services"`

### Phase 2 (SRP) - Days 5-8
- [ ] Decompose ConfigService
  - [ ] EnvVarProvider
  - [ ] JsonConfigLoader
  - [ ] Validators (Ollama, Chroma, CSV)
  - [ ] AppConfigBuilder
  
- [ ] Refactor vector.ts
  - [ ] DocumentPathResolver
  - [ ] CollectionNameGenerator
  - [ ] VectorStoreInitializer
  - [ ] RetrieverFactory
  
- [ ] Refactor watcher.ts
  - [ ] IngestionQueue
  - [ ] QueueProcessor
  - [ ] DocumentIngestionStrategy

- [ ] Verify `npm start` identical to before

- [ ] Quality gate: Can you test ConfigService without file I/O?
  - [ ] YES? → Continue
  - [ ] NO? → Debug Phase 2

- [ ] Commit: `git commit -m "feat: Decompose ConfigService and vector.ts"`

### Phase 3 (OCP) - Days 9-11
- [ ] DocumentLoaderRegistry
  - [ ] Create strategy interface
  - [ ] Implement registry
  - [ ] Register all loaders
  - [ ] Test adding new format

- [ ] Validation refactoring
  - [ ] Add Sanitizer interface
  - [ ] Add Validator interface
  - [ ] Wrap existing functions

- [ ] Verify no existing functionality broken

- [ ] Quality gate: Can you add Markdown support without modifying existing code?
  - [ ] YES? → Continue
  - [ ] NO? → Debug Phase 3

- [ ] Commit: `git commit -m "feat: Add strategy pattern for document loaders"`

### Phase 4 (Testing) - Days 12-16
- [ ] Write unit tests for pure functions (CollectionNameGenerator, etc.)
- [ ] Write integration tests for use cases
- [ ] Write adapter tests for services
- [ ] Aim for 85%+ coverage: `npm test -- --coverage`

- [ ] Quality gate: Can you test LLM switching (Ollama → OpenAI) with mock?
  - [ ] YES? → Continue
  - [ ] NO? → Add more tests

- [ ] Commit: `git commit -m "feat: Add comprehensive test suite"`

### Phase 5 (Cleanup) - Days 17-22
- [ ] Delete old  `src/config.ts` (once new system proven)
- [ ] Update all imports to use new paths
- [ ] Run `npm test` and `npm start` final time
- [ ] ESLint: `npm run lint` (0 warnings)
- [ ] Write ARCHITECTURE.md
- [ ] Write TESTING.md
- [ ] Write MIGRATION_GUIDE.md

- [ ] Quality gate: Are you confident in the refactoring?
  - [ ] YES? → Merge to main
  - [ ] NO? → Create PR for team review

- [ ] Commit: `git commit -m "fix: Clean up old code and add documentation"`
- [ ] PR: Create pull request against `main`

---

## 9. Gotchas & How to Avoid

| Gotcha | Problem | Fix |
|--------|---------|-----|
| Circular imports | A imports B, B imports A | Use interfaces in one direction only |
| Tests don't import | Tests can't find new code | Make sure exports in interfaces.ts are correct |
| npm start fails | Old code deleted too early | Keep old code during phases 1-4 |
| Performance regression | New DI is slower | Benchmark against old (usually no difference) |
| Type errors | DI types don't align | Use `implements` keyword to catch early |
| Config not loading | New config provider missing | Add default providers to factory |
| Tests timeout | Real Ollama call in test | Mock EmbeddingProvider interface |
| Singleton still used | Old code keeps ConfigService singleton | Find all getInstance() calls |

---

## 10. Rollback Plan

If anything goes wrong:

```bash
# Immediate rollback (less than 30 seconds)
git reset --hard HEAD~1
npm install
npm start

# Partial rollback (to specific phase)
git checkout feat/solid-refactoring    # Restart from beginning
git revert <commit-before-phase-3>     # Undo phase 3 only
npm test
npm start

# Full rollback to main branch
git checkout main
npm install
npm start
```

**Designed for safety**: Each phase is independent. If phase 3 breaks, revert only phase 3, not 1-2.

---

## 11. Success Looks Like

### BEFORE Refactoring (Current)
```bash
$ npm test
  ✗ Cannot test, all tests require Ollama + ChromaDB
  ✗ Cannot swap LLM providers
  ✗ Cannot add file formats without modifying code
  ✗ Config changes break everywhere
  ✗ main() function is god object (207 lines)
```

### AFTER Refactoring (Goal)
```bash
$ npm test
  ✓ 85%+ coverage
  ✓ All tests pass without Ollama
  ✓ Can test LLM behavior with mocks
  ✓ Can test config logic independently
  ✓ Can add file formats with strategy pattern
  ✓ main() is 40 lines, just orchestration

$ npm run lint
  ✓ 0 warnings
  ✓ No circular dependencies
  ✓ TypeScript strict mode passing

$ npm start
  ✓ Identical behavior to before
  ✓ No performance regression
  ✓ Clean architecture principles followed
```

---

## TLDR (Too Long, Didn't Read)

**In 30 seconds:**
1. main.ts is a 207-line god object (fix with DIP)
2. config.ts is a singleton mess (fix with SRP)
3. vector.ts is 100-line tangled function (fix with SRP + DIP)
4. Can't test any of this (fix with #1-3)
5. Can't extend without breaking (fix with OCP)

**Fix order:** DIP → SRP → OCP → Test → Done

**Effort:** 22-25 days, phases can be shortened

**Risk:** LOW (non-destructive refactoring, git rollback available)

**Start now:** `git checkout -b feat/solid-refactoring` and create `src/abstractions/interfaces.ts`
