# SOLID Refactoring Prioritization Report
## TypeScript Local RAG System - Implementation Action Plan

**Assessment Date:** March 4, 2026  
**Overall Health Score:** 6.2/10  
**Recommended Effort:** 22.5 days (5 phases)  
**Risk Level:** Medium (mitigation strategies provided)

---

## Executive Summary

The codebase has **critical architectural issues** that severely impact testability and maintainability. Three files account for 80% of SOLID violations: **main.ts** (DIP), **config.ts** (SRP), and **vector.ts** (SRP + DIP). The system demonstrates good type safety and documentation but suffers from tight framework coupling and mixed responsibilities.

**Key Finding:** Before fixing SRP violations, DIP violations must be addressed (dependency injection enables testable refactoring). The recommended approach is a **non-destructive refactoring path** that keeps old code functional during phases 1-3.

---

## PRIORITY 1 FILES: MUST FIX FIRST (Critical Path)

These files have violations so severe they block testability and extensibility. Fix these first.

---

### 🔴 Priority 1.1: `src/main.ts` (207 lines)

**Health Score:** 2.0/10  
**Primary Violations:**
- ❌ **DIP (Dependency Inversion Principle)** - CRITICAL
- ❌ **SRP (Single Responsibility)** - CRITICAL
- ⚠️ **OCP (Open/Closed)** - HIGH

**Violations Breakdown:**

| Violation | Type | Severity | Lines | Impact |
|-----------|------|----------|-------|--------|
| Direct Ollama import | DIP | Critical | 2 | Cannot swap LLM providers |
| Direct readline import | DIP | Critical | 9 | Cannot swap I/O handlers |
| InMemoryChatMessageHistory hardcoded | DIP | Critical | 18 | Cannot use persistent history |
| 8+ distinct responsibilities in main() | SRP | Critical | 24-124 | Cannot unit test any concern |
| Chain setup + UI + validation + retrieval | SRP | Critical | 31-110 | Cannot reuse logic |

**Concrete Problems:**

1. **Testing Nightmare**: Cannot write unit tests. Example - to test "when validator rejects input":
   - Must spin up real Ollama client ✗
   - Must initialize real readline interface ✗
   - Must connect to real ChromaDB ✗
   - Result: Only integration tests possible, no unit testing

2. **Extensibility Blocked**: To switch from Ollama to OpenAI:
   - Modify line 2: change import
   - Modify line 36: change instantiation
   - Modify config structure
   - Modify prompt template logic
   - Risk of breaking everything

3. **Mixed Concerns**: The function handles:
   - **Chain Orchestration** (lines 31-49): Prompt templates, models
   - **Message History** (line 18): Conversation context
   - **User Interaction** (lines 51-59): Readline setup
   - **Input Validation** (lines 89-93): Question validation
   - **Input Sanitization** (lines 95-96): Injection prevention
   - **Vector Retrieval** (lines 101-104): Database queries
   - **Response Formatting** (lines 106-110): Output display
   - **Error Handling** (lines 115-119): Exception management
   - **Loop Control** (lines 63-124): User interaction flow

**Refactoring Effort:** 8-12 hours

**Why Fix First:**
- Blocks all other refactoring efforts
- Once DIP is fixed, SRP violations become easier to extract
- Unblocks unit testing for entire system
- Enables clean architecture layers

**Quick Wins (can do immediately):**
1. Extract `new Ollama(config.ollama)` into a factory method
2. Extract `new InMemoryChatMessageHistory()` into a provider class
3. Extract `readline.createInterface()` into a user input handler
4. Create interfaces for each abstraction (ILanguageModel, IMessageHistory, etc.)

**Concrete Implementation Path:**

```typescript
// Step 1: Create abstractions (src/abstractions/interfaces.ts)
export interface ILanguageModel {
  invoke(input: Record<string, string>): Promise<string>;
}

export interface IMessageHistoryProvider {
  getHistory(): ChatMessageHistory;
  clear(): Promise<void>;
}

export interface IInputValidator {
  validate(input: string): { valid: boolean; error?: string };
}

export interface IInputSanitizer {
  sanitize(input: string): string;
}

export interface IUserInputHandler {
  prompt(question: string): Promise<string>;
  close(): void;
}

// Step 2: Create service implementations
// - OllamaLanguageModel implements ILanguageModel
// - InMemoryHistoryProvider implements IMessageHistoryProvider
// - DefaultInputValidator implements IInputValidator
// - DefaultInputSanitizer implements IInputSanitizer
// - ReadlineUserInputHandler implements IUserInputHandler

// Step 3: Create factory
export class RagServiceFactory {
  async createConfig(): Promise<IRagApplicationConfig> { /* ... */ }
}

// Step 4: Refactor main.ts to inject dependencies
async function main() {
  const factory = new RagServiceFactory();
  const config = await factory.createConfig();
  
  // Use injected abstractions
  // main() now is ~30 lines instead of 130
}
```

**Post-Refactoring Quality Gates:**
- ✓ `src/main.ts` imports no concrete frameworks (except initialization)
- ✓ `src/main.ts` has < 50 lines
- ✓ Can instantiate services independently for unit tests
- ✓ Can swap out Ollama for OpenAI by creating new factory

---

### 🔴 Priority 1.2: `src/config.ts` (217 lines)

**Health Score:** 3.5/10  
**Primary Violations:**
- ❌ **SRP (Single Responsibility)** - CRITICAL
- ⚠️ **DIP (Dependency Inversion)** - HIGH
- ⚠️ **OCP (Open/Closed)** - HIGH

**Violations Breakdown:**

| Violation | Type | Impact |
|-----------|------|--------|
| Handles env var loading + validation + defaults + JSON parsing | SRP | Cannot test config loading independently |
| Hardcoded configuration structure (5+ concerns) | SRP | Adding new config section requires modifying entire class |
| Direct file system dependency (readFileSync) | DIP | Cannot load config from database or remote API |
| Singleton pattern | DIP + Testing | Cannot test with multiple configs, thread-safety issues |
| JSON parsing mixed with validation | SRP | Cannot reuse validation logic |

**Concrete Problems:**

1. **Testing Impossible**: ConfigService is a singleton. To test different configs:
   ```typescript
   // Current (broken):
   const config1 = ConfigService.getInstance(url1);
   config1.getConfig(); // Returns cached config
   const config2 = ConfigService.getInstance(url2);
   config2.getConfig(); // Returns SAME cached config (singleton!)
   ```

2. **Monolithic Responsibility**: One class handles:
   - **Environment Variable Loading** (lines 138-150): Getting and defaulting env vars
   - **Configuration Validation** (lines 62-105): Checking required fields, transforming values
   - **JSON File Loading** (lines 152-180): Reading prompts JSON
   - **Default Value Management**: Applied throughout
   - **Singleton Lifecycle**: Instance management and thread safety

   To add PostgreSQL connection config:
   - Add interface to types.ts
   - Add method to ConfigService
   - Add getters to ConfigService
   - Add validation logic to ConfigService
   - Update getConfig() method
   - **Result: 5 files modified, 1 complex class gets more complex**

3. **Hard to Extend**: To support a new configuration source (e.g., environment variables from a secret manager):
   - Must modify ConfigService.getRequired()
   - Must handle both old and new sources
   - Risk of breaking existing code

**Refactoring Effort:** 6-8 hours

**Why Fix Early (but after DIP):**
- ConfigService is a global singleton: blocks all unit tests
- Once replaced with dependency injection, entire test suite becomes possible
- Removes "god object" anti-pattern

**Quick Wins:**

```typescript
// Step 1: Extract environment variable provider
class EnvVarProvider {
  getRequired(key: string): string { /* ... */ }
  getOptional(key: string, defaultValue: string): string { /* ... */ }
}

// Step 2: Extract JSON config loader
class JsonConfigLoader {
  load(path: string): PromptsConfig { /* ... */ }
}

// Step 3: Extract validators for each section
class OllamaConfigValidator {
  validate(data: any): OllamaConfig { /* ... */ }
}
class ChromaConfigValidator {
  validate(data: any): ChromaConfig { /* ... */ }
}

// Step 4: Create config builder
class AppConfigBuilder {
  constructor(envProvider: EnvVarProvider, jsonLoader: JsonConfigLoader) {}
  build(): AppConfig { /* delegates to validators */ }
}

// Step 5: Minimal ConfigService wrapper (no singleton)
export class ConfigService {
  private config: AppConfig;
  
  constructor(envProvider?: EnvVarProvider, jsonLoader?: JsonConfigLoader) {
    const builder = new AppConfigBuilder(envProvider || newEnvVarProvider(), jsonLoader || new JsonConfigLoader());
    this.config = builder.build();
  }
  
  getConfig(): AppConfig { return this.config; }
}

// Usage: Dependency injection instead of singleton
const envProvider = new EnvVarProvider();
const jsonLoader = new JsonConfigLoader();
const configService = new ConfigService(envProvider, jsonLoader);
```

**Post-Refactoring Quality Gates:**
- ✓ ConfigService is not a singleton
- ✓ Can instantiate multiple ConfigService instances with different configs
- ✓ Environment variable loading is testable independently
- ✓ JSON loading is testable independently
- ✓ Each validator is testable in isolation
- ✓ Config building is testable independent of file I/O

---

### 🔴 Priority 1.3: `src/vector.ts` (445 lines)

**Health Score:** 4.0/10  
**Primary Violations:**
- ❌ **SRP (Single Responsibility)** - CRITICAL
- ❌ **DIP (Dependency Inversion)** - HIGH
- ⚠️ **OCP (Open/Closed)** - HIGH

**Violations Breakdown:**

| Violation | Type | Severity | Impact |
|-----------|------|----------|--------|
| getRetriever() handles 7+ concerns | SRP | Critical | Cannot unit test, ~100 lines in one function |
| Direct OllamaEmbeddings dependency | DIP | High | Cannot swap embedding providers |
| Direct ChromaDB dependency | DIP | High | Cannot swap vector stores |
| Configuration lookup mixed in | DIP | High | Creates tight coupling to ConfigService |
| Path validation mixed in | SRP | High | Cannot test path logic independently |
| Collection naming logic not reusable | SRP | High | Multi-tenancy logic is implicit and untestable |

**Concrete Problems:**

1. **getRetriever() Does 8 Different Things**:
   ```typescript
   async function getRetriever(filePath?: string, clientId?: string) {
     // 1. Configuration loading
     const configService = ConfigService.getInstance(import.meta.url);
     const config = configService.getConfig();
     
     // 2. Path resolution
     const projectRoot = getDirname(import.meta.url);
     const projectRootDir = path.dirname(projectRoot);
     const docPath = filePath ? filePath : path.join(projectRootDir, config.csv.filePath);
     
     // 3. Path validation
     const validatedPath = validateFilePath(docPath, allowedBaseDir);
     
     // 4. File type detection
     const fileType = detectFileType(validatedPath);
     const fileName = path.basename(validatedPath, path.extname(validatedPath));
     
     // 5. Collection naming (multi-tenancy business logic!)
     const sanitizedSuffix = `${fileType}_${fileName}`...;
     const collectionName = (sanitizedClientId ? `${sanitizedClientId}_${sanitizedSuffix}` : sanitizedSuffix)...;
     
     // 6. Embedding initialization
     const embeddings = new OllamaEmbeddings(config.embeddings);
     
     // 7. Vector store resolution (create or connect)
     const vectorStore = await resolveVectorStore(embeddings, chromaConfig, validatedPath);
     
     // 8. Optional testing
     if (config.debug.vectorTest) { /* test vector store */ }
     
     // 9. Retriever creation
     return vectorStore.asRetriever({ k: 5 });
   }
   ```

   **Problem**: To test "collection naming", must:
   - Mock ConfigService ✗
   - Mock path resolution ✗
   - Mock OllamaEmbeddings ✗
   - Mock ChromaDB ✗
   - Result: Cannot isolate and test business logic

2. **Hard to Extend**: To use OpenAI embeddings instead of Ollama:
   - Must modify line 136: `const embeddings = new OllamaEmbeddings(...)`
   - PatchedChroma expects EmbeddingsInterface, so it might work, but:
   - Direct dependency on OllamaEmbeddings makes it unclear

3. **Direct Dependencies Block Alternative Implementations**:
   ```typescript
   // Hard dependencies
   const embeddings = new OllamaEmbeddings(config.embeddings);  // ← Concrete
   const vectorStore = await PatchedChroma.fromDocuments(docs, embeddings, chromaConfig);  // ← Concrete
   
   // To use different embeddings:
   // - Option 1: Modify this function
   // - Option 2: Create getRetrieverWithEmbeddings() (code duplication)
   // - Option 3: Create factory parameter (what we want, but doesn't exist)
   ```

**Refactoring Effort:** 8-10 hours

**Why Fix as Part of Priority 1:**
- Blocks extensibility (cannot add new embedding/vector store providers)
- Prevents unit testing of multi-tenancy logic
- Makes the system fragile to embedding provider changes

**Extraction Pattern:**

```typescript
// Step 1: Extract concerns into focused classes
class DocumentPathResolver {
  resolve(filePath: string | undefined, baseDir: string): string { /* ... */ }
}

class CollectionNameGenerator {
  generate(file: string, clientId?: string, fileType?: string): string {
    // Pure function, testable

     const sanitizedSuffix = `${fileType}_${fileName}`.toLowerCase();
    return (clientId ? `${clientId}_${sanitizedSuffix}` : sanitizedSuffix).substring(0, 63);
  }
}

class VectorStoreInitializer {
  async initialize(
    documents: Document[],
    embeddings: EmbeddingsInterface,
    config: ChromaLibArgs
  ): Promise<PatchedChroma> {
    // Only handles vector store creation
  }
}

// Step 2: Create RetrieverFactory
class RetrieverFactory {
  constructor(
    private pathResolver: DocumentPathResolver,
    private nameGenerator: CollectionNameGenerator,
    private storeInitializer: VectorStoreInitializer,
    private configService: ConfigService,
    private embeddingProvider: IEmbeddingProvider  // ← Injected
  ) {}

  async create(filePath?: string, clientId?: string): Promise<Retriever> {
    const config = this.configService.getConfig();
    const validatedPath = this.pathResolver.resolve(filePath, /* baseDir */);
    const documents = await loadDocuments(validatedPath);
    const collectionName = this.nameGenerator.generate(validatedPath, clientId);
    const vectorStore = await this.storeInitializer.initialize(
      documents,
      this.embeddingProvider.get(),  // Injected, not direct
      { ...config.chroma, collectionName }
    );
    return vectorStore.asRetriever({ k: 5 });
  }
}

// Step 3: Rewrite getRetriever as thin wrapper
export async function getRetriever(filePath?: string, clientId?: string) {
  const configService = new ConfigService(/* appropriate providers */);
  const embeddingProvider = new OllamaEmbeddingProvider(configService);  // Injected
  const factory = new RetrieverFactory(
    new DocumentPathResolver(),
    new CollectionNameGenerator(),
    new VectorStoreInitializer(),
    configService,
    embeddingProvider
  );
  return factory.create(filePath, clientId);
}
```

**Post-Refactoring Quality Gates:**
- ✓ CollectionNameGenerator is pure function, 100% testable
- ✓ PathResolver is isolated, independently testable
- ✓ VectorStoreInitializer is focused, independently testable
- ✓ RetrieverFactory can be tested without file I/O
- ✓ Can inject different embedding providers
- ✓ Can inject different configuration sources
- ✓ getRetriever() is ~5 lines instead of ~100
- ✓ Embedding provider swappable without modifying vector.ts

---

## PRIORITY 2 FILES: HIGH VALUE (Dependent on Priority 1)

These files have significant violations but are more isolated. Fix after Priority 1 is refactored.

---

### 🟠 Priority 2.1: `src/loaders/documentLoader.ts` (344 lines)

**Health Score:** 5.5/10  
**Primary Violations:**
- ⚠️ **OCP (Open/Closed Principle)** - HIGH
- ⚠️ **SRP (Single Responsibility)** - MEDIUM

**Violations Breakdown:**

| Violation | Type | Severity | Impact |
|-----------|------|----------|--------|
| Switch statement for file types | OCP | High | Cannot add Markdown/JSON without modifying function |
| loadDocuments() has multiple concerns | SRP | Medium | Document detection + dispatch + loading mixed |

**Concrete Problem:**

To add Markdown support, you must:
1. Create `loadMarkdown()` function
2. Modify the switch statement in `loadDocuments()`
3. Update `SupportedFileType` type
4. Update `SUPPORTED_EXTENSIONS` set
5. Update `KNOWN_FILE_TYPES` array
6. Update `detectFileType()` function
7. Update multiple files

**Current (Closed to Extension):**
```typescript
export async function loadDocuments(filePath: string): Promise<Document[]> {
  const fileType = detectFileType(filePath);
  
  switch (fileType) {
    case "csv":
      return loadCsv(filePath);
    case "pdf":
      return await loadPdf(filePath);
    case "docx":
      return await loadDocx(filePath);
    case "txt":
      return await loadTxt(filePath);
    // ❌ To add markdown: MUST MODIFY THIS FUNCTION
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
```

**Refactoring Effort:** 4-5 hours

**Why Fix After Priority 1:**
- Both are about extensibility (OCP)
- Can be deferred until Priority 1 injection framework is in place
- Lower impact than Priority 1 files
- Pattern from Priority 1 refactoring can inform this fix

**Quick Win - Strategy Pattern:**

```typescript
// Step 1: Define interface
interface DocumentLoader {
  load(filePath: string): Promise<Document[]>;
}

// Step 2: Implement loaders
class CsvDocumentLoader implements DocumentLoader {
  async load(filePath: string): Promise<Document[]> {
    return loadCsv(filePath);
  }
}

class PdfDocumentLoader implements DocumentLoader {
  async load(filePath: string): Promise<Document[]> {
    return loadPdf(filePath);
  }
}

class MarkdownDocumentLoader implements DocumentLoader {
  async load(filePath: string): Promise<Document[]> {
    // New implementation, no existing code modified!
  }
}

// Step 3: Create registry
class DocumentLoaderRegistry {
  private loaders = new Map<string, DocumentLoader>([
    ["csv", new CsvDocumentLoader()],
    ["pdf", new PdfDocumentLoader()],
    ["docx", new DocxDocumentLoader()],
    ["txt", new TxtDocumentLoader()],
    ["md", new MarkdownDocumentLoader()],  // ✓ NEW - no modification!
  ]);

  getLoader(fileType: string): DocumentLoader {
    const loader = this.loaders.get(fileType);
    if (!loader) throw new Error(`Unsupported file type: ${fileType}`);
    return loader;
  }
  
  register(fileType: string, loader: DocumentLoader): void {
    this.loaders.set(fileType, loader);
  }
}

// Step 4: Refactored loadDocuments
export async function loadDocuments(filePath: string): Promise<Document[]> {
  const fileType = detectFileType(filePath);
  const registry = new DocumentLoaderRegistry();
  const loader = registry.getLoader(fileType);
  return loader.load(filePath);
}
```

**Post-Refactoring Quality Gates:**
- ✓ Adding new file format requires ZERO modification to existing code
- ✓ Loaders are independently testable
- ✓ detectFileType() can be separated from loading logic
- ✓ Registry allows runtime loader registration
- ✓ Adding Markdown support: just implement MarkdownDocumentLoader, register it

---

### 🟠 Priority 2.2: `src/watcher.ts` (182 lines)

**Health Score:** 6.5/10  
**Primary Violations:**
- ⚠️ **SRP (Single Responsibility)** - MEDIUM
- ⚠️ **DIP (Dependency Inversion)** - MEDIUM

**Violations Breakdown:**

| Violation | Type | Severity | Impact |
|-----------|------|----------|--------|
| watcher orchestration + queue processing mixed | SRP | Medium | Cannot test queue logic independently |
| Direct getRetriever() call | DIP | Medium | Tightly coupled to specific ingestion strategy |
| Queue state management in globals | SRP | Medium | Difficult to test, thread-safety concerns |

**Concrete Problem:**

```typescript
async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return;  // ← Queue state management
  
  processing = true;
  const item = queue.shift()!;
  
  try {
    await getRetriever(item.filePath, item.clientId);  // ← Direct call, no abstraction
  } catch (err) {
    /* error handling */
  }
  
  queuedFiles.delete(item.filePath);
  processing = false;
}
```

**Why It Matters:**
- To test "when ingestion fails", must use real file system and ChromaDB
- To use different ingestion strategy, must modify this function
- Queue is global state, making tests non-isolated

**Refactoring Effort:** 3-4 hours

**Why Fix After Priority 1:**
- Depends on Priority 1 refactoring (getRetriever becomes injectable)
- Lower impact than Priority 1
- Can use same DI patterns as main.ts

**Extraction Pattern:**

```typescript
// Step 1: Extract queue manager
class IngestionQueue {
  private queue: QueueItem[] = [];
  private queuedFiles = new Set<string>();
  private processing = false;

  enqueue(item: QueueItem): void {
    if (this.queuedFiles.has(item.filePath)) return;
    this.queue.push(item);
    this.queuedFiles.add(item.filePath);
  }

  dequeue(): QueueItem | undefined {
    const item = this.queue.shift();
    if (item) {
      this.queuedFiles.delete(item.filePath);
    }
    return item;
  }

  isProcessing(): boolean { return this.processing; }
  setProcessing(value: boolean): void { this.processing = value; }
  isEmpty(): boolean { return this.queue.length === 0; }
}

// Step 2: Extract ingestion strategy
interface DocumentIngestionStrategy {
  ingest(filePath: string, clientId: string): Promise<void>;
}

class RagDocumentIngestionStrategy implements DocumentIngestionStrategy {
  async ingest(filePath: string, clientId: string): Promise<void> {
    await getRetriever(filePath, clientId);
  }
}

// Step 3: Extract queue processor
class QueueProcessor {
  constructor(
    private queue: IngestionQueue,
    private strategy: DocumentIngestionStrategy
  ) {}

  async process(): Promise<void> {
    if (this.queue.isProcessing() || this.queue.isEmpty()) return;

    this.queue.setProcessing(true);
    const item = this.queue.dequeue();

    if (item) {
      try {
        await this.strategy.ingest(item.filePath, item.clientId);
      } catch (err) {
        // error handling
      }
    }

    this.queue.setProcessing(false);
  }
}

// Step 4: Refactored watcher
const queue = new IngestionQueue();
const strategy = new RagDocumentIngestionStrategy();
const processor = new QueueProcessor(queue, strategy);

watcher.on("add", (filePath: string) => {
  // existing logic to extract clientId
  queue.enqueue({ filePath, clientId });
});

setInterval(() => {
  processor.process().catch((err) => {
    console.error("[watcher] Error:", err);
  });
}, 5000);
```

**Post-Refactoring Quality Gates:**
- ✓ IngestionQueue is independently testable (no side effects)
- ✓ QueueProcessor can be tested with mock strategy
- ✓ DocumentIngestionStrategy is injectable/swappable
- ✓ Can test queue ordering and deduplication in isolation
- ✓ Can swap ingestion implementation without modifying watcher

---

### 🟠 Priority 2.3: `src/validation.ts` (118 lines)

**Health Score:** 7.0/10  
**Primary Violations:**
- ⚠️ **ISP (Interface Segregation Principle)** - MEDIUM
- ⚠️ **SRP (Single Responsibility)** - LOW-MEDIUM

**Violations Breakdown:**

| Violation | Type | Severity | Impact |
|-----------|------|----------|--------|
| Multiple unrelated validations in one module | ISP | Medium | Clients get more than they need |
| Pure functions not encapsulated in classes | ISP | Low-Medium | Harder to mock/substitute |

**Concrete Problem:**

Currently, importing from validation.ts imports all three:
```typescript
import { sanitizeQuestion, validateFilePath, validateQuestion } from "./validation.js";
// Gets ALL three functions
// But a consumer might only need validateQuestion
```

**Refactoring Effort:** 2-3 hours

**Why Fix After Priority 1:**
- Lower impact than Priority 1 and 2.1-2.2
- Can use interface patterns from Priority 1 refactoring
- Non-blocking, polish work

**Extraction Pattern:**

```typescript
// Step 1: Create focused interfaces
interface Sanitizer {
  sanitize(input: string): string;
}

interface Validator<T> {
  validate(input: T): { valid: boolean; error?: string };
}

// Step 2: Create focused implementations
export class QuestionSanitizer implements Sanitizer {
  sanitize(input: string): string {
    return sanitizeQuestion(input);
  }
}

export class QuestionValidator implements Validator<string> {
  validate(input: string): { valid: boolean; error?: string } {
    return validateQuestion(input);
  }
}

export class FilePathValidator implements Validator<{path: string; baseDir: string}> {
  validate(input: {path: string; baseDir: string}): { valid: boolean; error?: string } {
    try {
      validateFilePath(input.path, input.baseDir);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }
}

// Step 3: Named exports for direct access (migration path)
export const sanitizeQuestion: Sanitizer = new QuestionSanitizer();
export const validateQuestion: Validator<string> = new QuestionValidator();
export const validateFilePath: Validator<...> = new FilePathValidator();

// Step 4: Inject into services
class InputProcessingService {
  constructor(
    private sanitizer: Sanitizer,
    private validator: Validator<string>
  ) {}

  process(input: string): { valid: boolean; sanitized?: string; error?: string } {
    const validation = this.validator.validate(input);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
    return {
      valid: true,
      sanitized: this.sanitizer.sanitize(input)
    };
  }
}
```

**Post-Refactoring Quality Gates:**
- ✓ Can inject QuestionValidator independently
- ✓ Can inject QuestionSanitizer independently
- ✓ Can mock Sanitizer/Validator interfaces
- ✓ Each validation concern is separately injectable
- ✓ Can test validation logic without other dependencies

---

## PRIORITY 3 FILES: POLISH (Optional, Low Impact)

These files are mostly good but could be improved. Fix only after Priority 1-2 are complete.

---

### 🟡 Priority 3.1: `src/types.ts` (79 lines)

**Health Score:** 8.0/10  
**Primary Violations:**
- ⚠️ **ISP (Interface Segregation)** - LOW

**One Issue, One Line:**
```typescript
export interface AppConfig {
  ollama: OllamaConfig;
  embeddings: OllamaEmbeddingsConfig;
  chroma: ChromaConfig;
  csv: CsvConfig;
  prompts: PromptsConfig;
  chatWindowSize: number;
  watcher: WatcherConfig;
  debug: { vectorTest: boolean };
  // ^ Functions depend on entire config, not just what they need
}
```

**Refactoring Effort:** 1 hour (optional)

**Recommended Improvement:**
```typescript
// Don't change the existing interface
// Instead, create focused interfaces for each concern

export interface RetrieverConfig {
  embeddings: OllamaEmbeddingsConfig;
  chroma: ChromaConfig;
  csv: CsvConfig;
  debug: { vectorTest: boolean };
}

export interface RagOrchestrationConfig {
  ollama: OllamaConfig;
  prompts: PromptsConfig;
  chatWindowSize: number;
}

export interface WatcherAgentConfig {
  watcher: WatcherConfig;
  csv: CsvConfig;
}

// Functions now accept focused interfaces
async function getRetriever(config: RetrieverConfig, filePath?: string) { }
async function main(config: RagOrchestrationConfig, retriever: Retriever) { }
async function startWatcher(config: WatcherAgentConfig) { }
```

**Post-Refactoring Quality Gates:**
- ✓ Functions depend only on what they need
- ✓ Easier to mock focused interfaces
- ✓ Clearer function contracts
- ✓ Reduced coupling to configuration shape

---

### 🟡 Priority 3.2: `src/utils/` (Minimal)

**Health Score:** 8.5/10

These are utility modules with no violations. Keep as-is.

---

## IMPLEMENTATION STRATEGY

### Recommended Approach: Non-Destructive Refactoring

**Why Not a Complete Rewrite:**
- ❌ Complete rewrites introduce bugs
- ❌ Hard to validate parity with existing behavior
- ❌ Risk of functionality loss during refactoring
- ✓ Non-destructive approach allows incremental validation

**Recommended Strategy:**

#### Phase 1: Build Abstractions in Parallel (Days 1-3)
- Create new `src/abstractions/` folder with interfaces
- Create new `src/services/` folder with implementations
- Create `src/factories/` with service factories
- **Old code untouched** - everything coexists
- Update only entry points to use new services

#### Phase 2: Refactor Modules (Days 4-6)
- Extract ConfigService → ConfigProvider pattern
- Extract getRetriever logic → RetrieverFactory
- Extract documentLoader → strategy pattern
- **Old code still works**, new code coexists
- Run full test suite after each extraction

#### Phase 3: Integration (Days 7-9)
- Wire up dependency injection container
- Update main.ts to use new factory
- Update watcher.ts to use new patterns
- Verify all tests pass
- **Final validation**: npm start still works

#### Phase 4: Cleanup (Days 10-11)
- Delete old files once new patterns proven
- Update imports across codebase
- Final test run

#### Phase 5: Tests + Documentation (Days 12+)
- Write comprehensive unit tests (20+ files)
- Document new architecture
- Update README

### Key Principle: Keep Two Systems Running in Parallel

```
OLD SYSTEM                    NEW SYSTEM
main.ts ────────────┐         main.ts ────────────┐
                   │                             │
├─ config.ts       │         ├─ ConfigProvider
├─ vector.ts       ├ WORKS   ├─ RetrieverFactory
├─ validation.ts   │         ├─ DocumentLoaderRegistry
├─ watcher.ts      │         ├─ DI Container
                   │                             │
BOTH SYSTEMS ◄─────┴─────────┴─► LIVE IN PARALLEL
TEST AGAINST BOTH
FLIP SWITCH IN main.ts
DELETE OLD SYSTEM

```

### Fallback Strategy

If new system doesn't work:
1. Revert to old system (git branch)
2. No functionality lost
3. No downtime
4. Restart with lessons learned

---

## PHASE BREAKDOWN (22.5 days estimated)

### Phase 1: DIP (Dependency Inversion) - Days 1-4
**Output:** Abstraction layer enables unit testing

**Effort:** 12-15 hours

**Deliverables:**
1. `src/abstractions/interfaces.ts`
   - ILanguageModel
   - IMessageHistoryProvider
   - IInputValidator
   - IInputSanitizer
   - IUserInputHandler
   - IEmbeddingProvider
   - IConfigSource

2. `src/services/` (implementation classes)
   - OllamaLanguageModel
   - InMemoryHistoryProvider
   - DefaultInputValidator
   - DefaultInputSanitizer
   - ReadlineUserInputHandler
   - OllamaEmbeddingProvider
   - EnvVarConfigSource

3. `src/factories/`
   - RagServiceFactory
   - DocumentLoaderFactory
   - ConfigProviderFactory

4. Updated `src/main.ts` (40 lines instead of 207)

**Quality Gates:**
- ✓ Can unit test language model behavior with mock
- ✓ Can unit test input validation independently
- ✓ Can unit test history management independently
- ✓ npm start still works identically
- ✓ All existing functionality preserved

**Why Phase 1 First:**
- Unblocks all other refactoring
- Once DIP is fixed, SRP extractions are straightforward
- Enables unit testing for everything else

---

### Phase 2: SRP (Single Responsibility) - Days 5-8
**Output:** Each class/function has ONE reason to change

**Effort:** 14-16 hours

**Deliverables:**
1. ConfigService decomposition
   - EnvVarProvider
   - JsonConfigLoader
   - OllamaConfigValidator
   - ChromaConfigValidator
   - etc.
   - AppConfigBuilder

2. Vector store refactoring
   - DocumentPathResolver
   - CollectionNameGenerator
   - VectorStoreInitializer
   - RetrieverFactory

3. Watcher refactoring
   - IngestionQueue
   - QueueProcessor
   - DocumentIngestionStrategy

4. Updated `src/watcher.ts` (30 lines instead of 182)

**Quality Gates:**
- ✓ CollectionNameGenerator is pure function
- ✓ PathResolver is independently testable
- ✓ ConfigService is no longer singleton
- ✓ Can test each component independently
- ✓ npm start still works

**Why Phase 2 After Phase 1:**
- Phase 1 DIP work enables Phase 2 SRP extractions
- SRP extractions benefit from dependency injection framework
- Lower risk once abstractions are in place

---

### Phase 3: OCP (Open/Closed) - Days 9-11
**Output:** System extensible without modification

**Effort:** 10-12 hours

**Deliverables:**
1. DocumentLoaderRegistry
   - Strategy pattern for file type loaders
   - Support for adding new formats without code changes
   - Tests for each loader format

2. Update validation.ts
   - QuestionSanitizer implements ISanitizer
   - QuestionValidator implements IValidator
   - FilePathValidator implements IValidator

3. Configuration extensibility
   - Support for multiple config sources
   - Pluggable embedding providers
   - Pluggable vector stores

**Quality Gates:**
- ✓ Can add Markdown support without modifying existing code
- ✓ Can swap Ollama for OpenAI without changing main files
- ✓ Can use different config sources without modification
- ✓ npm start still works

---

### Phase 4: Testing - Days 12-16
**Output:** Comprehensive test coverage

**Effort:** 20-25 hours

**Deliverables:**
1. Unit tests for domain logic (~500 lines)
   - CollectionNameGenerator.test.ts
   - DocumentPathResolver.test.ts
   - InputValidator.test.ts
   - InputSanitizer.test.ts

2. Integration tests for use cases (~400 lines)
   - AskQuestion integration test
   - IngestDocuments integration test
   - WatcherQueue integration test

3. Adapter tests for services (~300 lines)
   - OllamaLanguageModel.test.ts
   - ConfigProvider.test.ts
   - DocumentLoaderRegistry.test.ts

4. E2E tests (optional) (~200 lines)

**Coverage Target:** 85%+ overall

**Quality Gates:**
- ✓ Domain logic: 95%+ coverage
- ✓ Use cases: 90%+ coverage
- ✓ Adapters: 80%+ coverage
- ✓ All tests pass
- ✓ No console warnings

---

### Phase 5: Cleanup & Documentation - Days 17-22
**Output:** Production-ready refactored system

**Effort:** 15-20 hours

**Deliverables:**
1. Code cleanup
   - Delete old files once new patterns validated
   - Update all imports
   - Remove dead code
   - ESLint pass with 0 warnings

2. Documentation
   - ARCHITECTURE.md (layer diagram)
   - DEPENDENCY_INJECTION.md (DI pattern guide)
   - TESTING.md (test strategy)
   - MIGRATION_GUIDE.md (team reference)
   - Updated README.md

3. Development tooling
   - Pre-commit hooks for tests
   - CI/CD pipeline updates
   - Jest coverage thresholds
   - TypeScript strict mode

4. Verification
   - ✓ npm start works identically
   - ✓ All tests pass (85%+ coverage)
   - ✓ No circular dependencies
   - ✓ No console errors
   - ✓ Performance no worse than before

---

## SPECIFIC QUESTIONS FOR DEVELOPER

### Question 1: Which SOLID Principle Is Most Critical to Fix First?

**Answer: Dependency Inversion (DIP) must be fixed first.**

**Reasoning:**
- **DIP unblocks SRP and OCP refactoring** - Once you have abstractions and dependency injection, SRP and OCP becomes straightforward
- **DIP enables unit testing** - Without it, you can only write integration tests
- **DIP is in main.ts, the entry point** - Fixing main.ts first means all other modules can then be refactored confidently
- **SRP and OCP improvements depend on having good abstractions** - DIP provides those abstractions

**Impact Hierarchy:**
```
DIP (Foundation) ◄── SRP & OCP (Built on DIP)
  ├─ Enables unit tests
  ├─ Provides abstractions
  └─ Makes other refactoring safe

SRP (Organization) ◄── OCP (Extended safely)
  ├─ Reduces function complexity
  ├─ Improves testability
  └─ Makes code more reusable

OCP (Extensibility)
  └─ Allows adding features without modification
```

**Concrete Recommendation:**
1. **Week 1:** Fix DIP in main.ts, config.ts, vector.ts
2. **Week 2:** Fix SRP violations that DIP exposed
3. **Week 3:** Implement OCP patterns
4. **Week 4:** Testing and cleanup

---

### Question 2: Should ConfigService Be Completely Rewritten or Refactored?

**Answer: Refactor (don't rewrite). Extract responsibility into separate classes.**

**Current State:**
- ConfigService handles 5+ concerns
- Singleton makes testing impossible
- Direct file system dependency

**Recommended: Decompose, Don't Rewrite**

```typescript
// WRONG approach (rewrite from scratch)
// - Risk losing edge cases
// - Breaks during transition
// - Hard to validate parity

// RIGHT approach (extract responsibilities)
// 1. Create EnvVarProvider (testable)
// 2. Create JsonConfigLoader (testable)
// 3. Create Validators (testable)
// 4. Gradually migrate to new providers
// 5. ConfigService becomes thin coordinator
// 6. Run both systems in parallel until proven
// 7. Delete old ConfigService
```

**Why Not Singleton:**
```typescript
// ❌ Current singleton problem
const config1 = ConfigService.getInstance(url);
config1.getConfig(); // Loads and caches

const config2 = ConfigService.getInstance(different_url);
config2.getConfig(); // Returns SAME cache - wrong!

// ✓ Fixed with dependency injection
const provider1 = new EnvVarProvider(env1);
const configService1 = new ConfigService(provider1);

const provider2 = new EnvVarProvider(env2);
const configService2 = new ConfigService(provider2);
// Each has its own cache, correct behavior
```

**Refactoring Steps:**
1. Create `EnvVarProvider` - handles environment variable logic
2. Create `JsonConfigLoader` - handles file loading
3. Create validators for each config section
4. Create `AppConfigBuilder` - orchestrates the others
5. Update ConfigService to use builder (no singleton)
6. Update main.ts to inject ConfigService via DI
7. Delete old ConfigService code

**Timeline:** 6-8 hours (part of Phase 1-2)

---

### Question 3: Is Switching from Ollama to OpenAI a Future Requirement?

**Answer: This determines DIP urgency in main.ts and vector.ts.**

**If YES (Likely):**
- **DIP is CRITICAL** - Main.ts has hardcoded Ollama import
- **Vector.ts has hardcoded OllamaEmbeddings** - Must fix
- **Timeline:** Implement DIP in Phase 1 (Days 1-4)
- **Benefit:** Can swap LLM providers with single config change

**Current Blocker:**
```typescript
// main.ts (line 2)
import { Ollama } from "@langchain/ollama";  // ← Hardcoded
// ...
const model = new Ollama(config.ollama);  // ← Hardcoded
// To use OpenAI: modify import + instantiation + config structure
```

**DIP Solution (After Refactoring):**
```typescript
// Uses interface, not concrete Ollama
const model = languageModelFactory.create(config);

// In config:
{ llmProvider: "openai", openai: {...} }
// OR
{ llmProvider: "ollama", ollama: {...} }

// Factory handles which concrete class to instantiate
// main.ts doesn't change!
```

**Recommend:** Plan for OpenAI support as part of DIP refactoring.

---

### Question 4: Will New File Formats (Markdown, JSON) Be Added?

**Answer: This determines OCP urgency in documentLoader.ts.**

**If YES (Likely):**
- **OCP is HIGH priority** - Current switch statement closed to extension
- **Strategy pattern needed** - Can't add formats without modifying code
- **Timeline:** Implement OCP in Phase 3 (Days 9-11)

**Current Blocker:**
```typescript
// documentLoader.ts - to add Markdown
// MUST modify this function:
switch (fileType) {
  case "csv": ...
  case "pdf": ...
  case "docx": ...
  // MUST ADD: case "md": ...  ← CODE CHANGE REQUIRED
}
```

**OCP Solution (After Refactoring):**
```typescript
class DocumentLoaderRegistry {
  private loaders = new Map<string, DocumentLoader>([
    ["csv", new CsvLoader()],
    ["pdf", new PdfLoader()],
    ["md", new MarkdownLoader()],  // ← No existing code modified!
  ]);
}

// To add JSON format:
registry.register("json", new JsonLoader());
// That's literally it. No existing code changes.
```

**Recommend:** Plan for Markdown+ support as part of OCP refactoring.

---

### Question 5: What's the Risk of Non-Destructive Refactoring?

**Answer: Low risk with proper planning.**

**Risks & Mitigation:**

| Risk | Severity | Mitigation |
|------|----------|-----------|
| New code has bugs | Medium | Write tests first (TDD), run in parallel |
| Functionality parity | Medium | Run both systems, compare outputs |
| Performance regression | Low | Benchmark both systems |
| Team confusion | Medium | Document incrementally, pair programming |
| Budget overrun | High | Time-box each phase, prioritize hard |

**Risk Mitigation Strategy:**

1. **Keep Both Systems Running** (Days 1-10)
   - Old code: `src/config.ts`, `src/vector.ts`, etc.
   - New code: `src/abstractions/`, `src/services/`, `src/factories/`
   - main.ts imports from NEW system
   - Everything still works, both systems verify each other

2. **Git Strategy**
   - Create `feat/solid-refactoring` branch per phase
   - Easy to revert if issues found
   - Commit after each quality gate passes

3. **Testing Strategy**
   - Write tests BEFORE refactoring (TDD)
   - Tests validate both old and new systems
   - Run test suite after each extraction

4. **Validation Strategy**
   - Integration tests against real Ollama + Chroma
   - Manual testing: `npm start` works identically
   - No new errors in console

**Why Non-Destructive Reduces Risk:**
```
REWRITE APPROACH (High Risk)
Day 1-15: Write new code
Day 15: Flip switch
Day 15: 💥 Everything on fire, no fallback

NON-DESTRUCTIVE APPROACH (Low Risk)
Day 1-9: Write new code alongside old
Day 10: Validate new code works
Day 11: Switch imports
Day 12: Delete old code only if all tests pass
Day 13-22: Polish, tests, documentation
Fallback: Revert to old code if needed ✓
```

**Recommendation:** Use git branches. If Phase 1 doesn't work, revert and restart with lessons learned. Cost: 1 day, not 2 weeks.

---

## EFFORT ESTIMATES SUMMARY

| Phase | Focus | Days | Dependencies | Risk |
|-------|-------|------|--------------|------|
| 1 | DIP (Dependency Injection) | 3-4 | None | Low |
| 2 | SRP (Extract Responsibilities) | 3-4 | Phase 1 | Low |
| 3 | OCP (Strategy Patterns) | 2-3 | Phase 1-2 | Low |
| 4 | Testing (20+ test files) | 5-6 | Phase 1-3 | Medium |
| 5 | Cleanup & Docs | 3-4 | Phase 1-4 | Low |
| **TOTAL** | **Full Refactoring** | **16-21** | **Sequential** | **Medium** |

**Add 2-3 days for:**
- Documentation review
- Team onboarding
- Edge case handling
- Performance validation

**Realistic Timeline:** 22-25 days with proper pauses between phases.

---

## DECISION MATRIX

**Use this to decide what to prioritize:**

### If Budget Is Tight (5-10 days):
1. ✅ Fix DIP in main.ts (Days 1-3)
   - Unblocks all other work
   - Most critical
   - Smallest impact to existing code

2. ✅ Add unit tests (Days 4-5)
   - Validates DIP refactoring
   - Catches edge cases early

3. ❌ Skip SRP, OCP, cleanup for now
4. ❌ Defer Phase 4-5 for later

**Result:** System now testable, extensible for LLM providers. Can expand later.

### If Budget Is Medium (12-15 days):
1. ✅ Phase 1: DIP (3-4 days)
2. ✅ Phase 2: SRP (3-4 days)
3. ✅ Phase 4: Testing (4-5 days)
4. ❌ Phase 3: OCP (defer)
5. ❌ Phase 5: Cleanup (partial)

**Result:** System now testable and maintainable. OCP work (file formats) can wait.

### If Budget Is Full (22-25 days):
1. ✅ All 5 phases
   - Complete refactoring
   - Comprehensive tests
   - Full documentation
   - Production-ready

**Result:** Clean architecture, fully extensible, excellent maintainability.

---

## Quick Action Plan (Print This)

### Week 1: Foundation (DIP)
- [ ] Day 1: Design interfaces in `src/abstractions/`
- [ ] Day 2: Implement services in `src/services/`
- [ ] Day 3: Create factories in `src/factories/`
- [ ] Day 4: Update main.ts, verify npm start works

### Week 2: Organization (SRP)
- [ ] Day 5: Decompose ConfigService
- [ ] Day 6: Refactor vector.ts → RetrieverFactory
- [ ] Day 7: Extract watcher queue logic
- [ ] Day 8: Run full test suite, verify npm start

### Week 3: Extensibility (OCP) + Testing
- [ ] Day 9: Implement DocumentLoaderRegistry
- [ ] Day 10: Add strategy pattern to validation
- [ ] Day 11-14: Write unit tests (20+ files)
- [ ] Day 15: Integration tests, E2E validation

### Week 4: Polish
- [ ] Day 16-17: Delete old code (once new code proven)
- [ ] Day 18-19: Update imports, fix ESLint
- [ ] Day 20-21: Write documentation
- [ ] Day 22: Final validation, GitHub Actions setup

---

## Success Criteria (Post-Refactoring)

✅ **Architecture:**
- [ ] No imports from main.ts in domain/application layers
- [ ] All external dependencies behind interfaces
- [ ] No circular dependencies (run dependency-cruiser)
- [ ] Dependency Inversion principle 95%+ compliance

✅ **Code Quality:**
- [ ] Test coverage 85%+
- [ ] ESLint 0 warnings
- [ ] TypeScript strict mode: enabled
- [ ] No console.log in production code

✅ **Functionality:**
- [ ] `npm start` works identically
- [ ] `npm run watch` works identically
- [ ] All tests pass (100%)
- [ ] No type errors

✅ **Extensibility:**
- [ ] Can add new file format without modifying existing code ✓
- [ ] Can swap Ollama for OpenAI without modifying main files ✓
- [ ] Can inject new config source without code changes ✓

✅ **Documentation:**
- [ ] ARCHITECTURE.md explains layer boundaries
- [ ] DEPENDENCY_INJECTION.md explains DI pattern
- [ ] TESTING.md explains test strategy
- [ ] README.md updated with refactoring notes

---

## Conclusion

The refactoring is **challenging but achievable**, with clear phases and low risk via non-destructive approach. The largest effort is not the refactoring itself (12-15 hours) but the testing (20-25 hours) that gives confidence in the result. 

**Recommended starting point:** Begin with Phase 1 (DIP in main.ts) to immediately unblock unit testing, then Phase 2 (SRP in ConfigService) to improve maintainability. This 6-8 day effort has maximum impact and enables the rest of the refactoring.

The system will be **significantly more maintainable, testable, and extensible** at the end.
