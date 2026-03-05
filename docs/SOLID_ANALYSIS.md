# SOLID Principles Analysis Report
## Local RAG System - TypeScript Codebase

**Analysis Date:** March 2, 2026  
**Files Analyzed:** main.ts, config.ts, types.ts, vector.ts, validation.ts, loaders/documentLoader.ts

---

## Executive Summary

The codebase demonstrates **moderate adherence** to SOLID principles with clear strengths in type definitions but significant concerns in code organization and dependency management. The main challenge is excessive responsibility concentration in utility functions and the ConfigService class.

**Overall Health Score:** 6.2/10

---

## 1. SINGLE RESPONSIBILITY PRINCIPLE (SRP)

### Current State: **MEDIUM VIOLATION**

Classes and functions should have exactly one reason to change. Analysis reveals multiple violations where functions and modules handle unrelated concerns.

---

### ❌ CRITICAL: main.ts - main() Function Violates SRP

**Severity:** Critical  
**Lines:** 24-124

**Issues:**
The `main()` function has **7+ distinct responsibilities**:

1. **LLM Chain Setup** (lines 31-49): Creating prompt templates and chains
2. **Message History Management** (lines 18-19): Initializing and managing chat context
3. **Input/Output Setup** (lines 51-59): Readline interface creation
4. **User Interaction Loop** (lines 63-124): Main loop logic
5. **Input Validation** (lines 89-93): Validating user questions
6. **Input Sanitization** (lines 95-96): Sanitizing against injection attacks
7. **Vector Retrieval** (lines 101-104): Querying the vector database
8. **Response Processing** (lines 106-110): Formatting and displaying results
9. **Error Handling** (lines 115-119, 127-130): Error management across all concerns

**Current Code:**
```typescript
async function main() {
  // ... 7+ different concern categories mixed together
  while (true) {
    // Input handling, validation, sanitization, retrieval, processing all in one loop
  }
}
```

**Impact:**
- **Testing:** Cannot unit test individual responsibilities
- **Reusability:** Cannot reuse chain setup, message history, or input handling in other contexts
- **Maintenance:** Difficult to locate and fix issues specific to one concern
- **Change Frequency:** One change in any responsibility requires touching the entire function

**Recommended Fix:**
Extract into separate classes/functions with single responsibilities:

```typescript
// 1. Create a dedicated ChainBuilder class
class ChainBuilder {
  build(config: AppConfig): RunnableWithMessageHistory {
    const prompt = this.createPrompt(config);
    const model = this.createModel(config);
    return this.createChainWithHistory(prompt, model);
  }
}

// 2. Extract message history management
class MessageHistoryManager {
  private history = new InMemoryChatMessageHistory();
  async clear() { await this.history.clear(); }
  get() { return this.history; }
}

// 3. Extract input processing pipeline
class InputProcessor {
  async process(input: string, retriever: any): Promise<string> {
    const validated = this.validateQuestion(input);
    const sanitized = this.sanitizeQuestion(validated);
    const documents = await this.retrieveDocuments(sanitized, retriever);
    return documents;
  }
}

// 4. Extract user interaction
class UserInteractionHandler {
  async handleUserInput(prompt: string): Promise<string> {
    // readline logic
  }
}

// 5. Refactored main function
async function main() {
  const config = ConfigService.getInstance(import.meta.url).getConfig();
  const chainBuilder = new ChainBuilder();
  const historyManager = new MessageHistoryManager();
  const inputProcessor = new InputProcessor();
  
  // Much simpler orchestration
  const chain = chainBuilder.build(config);
  const retriever = await getRetriever();
  
  const handler = new UserInteractionHandler();
  // Simple loop that delegates to handlers
}
```

---

### ❌ HIGH: ConfigService - Multiple Responsibilities

**Severity:** High  
**Location:** config.ts (lines 37-110)

**Issues:**
ConfigService manages multiple concerns:

1. **Environment Variable Management** (lines 138-150): Handling required/optional env vars
2. **Configuration Validation** (lines 62-105): Validating and transforming config values
3. **JSON File Loading** (lines 152-180): Reading and parsing JSON files
4. **Default Value Management** (lines 62-105): Handling defaults for each section
5. **Singleton Pattern Management** (lines 14-30): Managing singleton lifecycle

**Current Code:**
```typescript
class ConfigService {
  getConfig(): AppConfig {
    // Loads from env vars, JSON files, applies defaults, validates all at once
    const promptsConfig = this.loadPromptsConfig();  // JSON loading
    this.config = {
      ollama: { ... },                               // Env var + defaults
      embeddings: { ... },                           // Env var + defaults
      // ... 5+ more config sections
    };
  }
}
```

**Why It's a Problem:**
- If env var loading strategy changes, entire ConfigService changes
- If JSON schema changes, entire ConfigService changes
- If validation rules change, entire ConfigService changes
- If default values change, entire ConfigService changes
- Cannot reuse env var loading for other purposes

**Recommended Fix:**
Extract into separate, composable classes:

```typescript
// 1. Environment variable handler
class EnvVarProvider {
  getRequired(key: string): string { /* ... */ }
  getOptional(key: string, defaultValue: string): string { /* ... */ }
}

// 2. JSON file loader
class JsonConfigLoader {
  loadPromptsConfig(path: string): PromptsConfig { /* ... */ }
}

// 3. Config validators
class OllamaConfigValidator {
  validate(data: any): OllamaConfig { /* ... */ }
}

class ChromaConfigValidator {
  validate(data: any): ChromaConfig { /* ... */ }
}

// 4. Config builder
class AppConfigBuilder {
  constructor(envProvider: EnvVarProvider, jsonLoader: JsonConfigLoader) {}
  build(): AppConfig { /* delegates to validators */ }
}

// 5. Simpler singleton wrapper
export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;
  
  static getInstance(): ConfigService { /* ... */ }
  getConfig(): AppConfig { /* delegates to builder */ }
}
```

---

### ❌ HIGH: vector.ts - getRetriever() Function

**Severity:** High  
**Lines:** 145-251

**Issues:**
The `getRetriever()` function handles 5+ distinct concerns:

1. **Configuration Loading** (lines 148-149): Reading config
2. **Path Management** (lines 151-156): Resolving project paths
3. **Path Validation** (lines 164): Security validation
4. **Document Loading** (line 167): Loading from disk
5. **Collection Naming** (lines 170-182): Generating collection identifiers
6. **Vector Store Initialization** (lines 192-220): Creating/connecting to database
7. **Vector Store Testing** (lines 233-244): Debug functionality
8. **Retriever Creation** (lines 247-250): Creating the retriever

**Current Code:**
```typescript
export async function getRetriever(filePath?: string, clientId?: string) {
  // Config loading
  const config = configService.getConfig();
  
  // Path resolution
  const docPath = filePath ? filePath : path.join(...);
  
  // Path validation
  const validatedPath = validateFilePath(docPath, allowedBaseDir);
  
  // Document loading
  const documents = await loadDocuments(validatedPath);
  
  // Collection naming
  const collectionName = ...;
  
  // Vector store initialization
  try {
    vectorStore = await PatchedChroma.fromExistingCollection(...);
  } catch {
    vectorStore = await PatchedChroma.fromDocuments(...);
  }
  
  // Testing
  if (config.debug.vectorTest) { ... }
  
  // Retriever creation
  return vectorStore.asRetriever({ k: 5 });
}
```

**Problems:**
- Very difficult to test in isolation
- Cannot reuse document loading without running full pipeline
- Cannot test vector store initialization separately
- Path validation mixed with vector setup
- Debug logic mixed with production logic

**Recommended Fix:**
Extract into focused classes:

```typescript
class VectorStoreInitializer {
  async initialize(
    documents: Document[],
    embeddings: EmbeddingsInterface,
    config: ChromaConfig
  ): Promise<PatchedChroma> {
    // Only handles vector store initialization
  }
}

class CollectionNameGenerator {
  generate(filePath: string, clientId?: string, fileType?: string): string {
    // Only handles naming logic
  }
}

class DocumentPathResolver {
  resolve(filePath: string | undefined, baseDir: string): string {
    // Only handles path resolution
  }
}

class RetrieverFactory {
  async create(config: AppConfig, filePath?: string, clientId?: string): Promise<Retriever> {
    const pathResolver = new DocumentPathResolver();
    const documents = await loadDocuments(
      pathResolver.resolve(filePath, this.getAllowedBaseDir(clientId))
    );
    const nameGenerator = new CollectionNameGenerator();
    const vectorStore = await new VectorStoreInitializer().initialize(...);
    if (config.debug.vectorTest) {
      await this.runDiagnostics(vectorStore);
    }
    return vectorStore.asRetriever({ k: 5 });
  }
}
```

---

### ⚠️ MEDIUM: documentLoader.ts - Switch Statement for File Types

**Severity:** Medium  
**Lines:** 146-164

**Issue:**
The `loadDocuments()` function uses a switch statement to handle different file types. This violates SRP and OCP.

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
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
```

**Why It's Problematic:**
- The function now has responsibilities for CSV, PDF, and DOCX loading
- To support a new format (e.g., Markdown), must modify this function
- Cannot reuse individual loaders without going through this dispatcher

**Recommended Fix:**
Use a strategy pattern or registry:

```typescript
interface DocumentLoader {
  load(filePath: string): Promise<Document[]>;
}

class CsvDocumentLoader implements DocumentLoader {
  load(filePath: string): Promise<Document[]> { return loadCsv(filePath); }
}

class PdfDocumentLoader implements DocumentLoader {
  load(filePath: string): Promise<Document[]> { return loadPdf(filePath); }
}

class DocxDocumentLoader implements DocumentLoader {
  load(filePath: string): Promise<Document[]> { return loadDocx(filePath); }
}

class DocumentLoaderRegistry {
  private loaders = new Map<string, DocumentLoader>([
    ["csv", new CsvDocumentLoader()],
    ["pdf", new PdfDocumentLoader()],
    ["docx", new DocxDocumentLoader()],
  ]);
  
  getLoader(fileType: string): DocumentLoader {
    const loader = this.loaders.get(fileType);
    if (!loader) throw new Error(`Unsupported file type: ${fileType}`);
    return loader;
  }
}

export async function loadDocuments(filePath: string): Promise<Document[]> {
  const fileType = detectFileType(filePath);
  const loader = new DocumentLoaderRegistry().getLoader(fileType);
  return loader.load(filePath);
}
```

---

## 2. OPEN/CLOSED PRINCIPLE (OCP)

### Current State: **MEDIUM-HIGH VIOLATION**

Code should be open for extension, closed for modification. Multiple areas require modification to extend functionality.

---

### ❌ CRITICAL: documentLoader.ts - Hardcoded File Type Handling

**Severity:** Critical  
**Lines:** 146-164

**Issue:**
To add support for a new file format (Markdown, JSON, XML), you must:
1. Create a new loader function (e.g., `loadMarkdown()`)
2. Add a new case to the switch statement
3. Update `SupportedFileType` type
4. The module is now CLOSED to extension

**Current State:**
```typescript
type SupportedFileType = "csv" | "pdf" | "docx";

switch (fileType) {
  case "csv": return loadCsv(filePath);
  case "pdf": return await loadPdf(filePath);
  case "docx": return await loadDocx(filePath);
  // Adding .txt file type requires modifying this file
}
```

**Recommended Fix: Strategy Pattern**
```typescript
interface DocumentLoaderStrategy {
  load(filePath: string): Promise<Document[]>;
}

class MarkdownLoader implements DocumentLoaderStrategy {
  load(filePath: string): Promise<Document[]> { /* ... */ }
}

class DocumentLoaderRegistry {
  private loaders = new Map<string, DocumentLoaderStrategy>();
  
  register(ext: string, loader: DocumentLoaderStrategy) {
    this.loaders.set(ext, loader);
  }
  
  getLoader(ext: string): DocumentLoaderStrategy {
    const loader = this.loaders.get(ext);
    if (!loader) throw new Error(`Unsupported: ${ext}`);
    return loader;
  }
}

// Usage - now you can add new loaders without modifying original code
const registry = new DocumentLoaderRegistry();
registry.register("csv", new CsvLoader());
registry.register("pdf", new PdfLoader());
registry.register("md", new MarkdownLoader()); // NEW - no modification needed!
```

---

### ❌ HIGH: config.ts - Hardcoded Configuration Structure

**Severity:** High  
**Lines:** 62-105

**Issue:**
The AppConfig structure is hardcoded in the `getConfig()` method. To add a new configuration section (e.g., `database: DatabaseConfig`), you must:
1. Add the interface to types.ts
2. Modify the `getConfig()` method to load it
3. Add a new getter method (e.g., `getDatabaseConfig()`)

**Current Code:**
```typescript
getConfig(): AppConfig {
  // Must manually add every new config section here
  this.config = {
    ollama: { ... },      // Manual
    embeddings: { ... },  // Manual
    chroma: { ... },      // Manual
    csv: { ... },         // Manual
    prompts: { ... },     // Manual
    watcher: { ... },     // Manual
    debug: { ... },       // Manual
  };
}
```

**Problem:**
Every new feature requires modifying the ConfigService class. The class is CLOSED to extension.

**Recommended Fix: Configuration Loader Pattern**
```typescript
interface ConfigProvider {
  load(): Promise<void>;
  get<T>(key: string): T;
}

class EnvironmentConfigProvider implements ConfigProvider {
  async load() { /* load from env */ }
  get<T>(key: string): T { /* get from cache */ }
}

class FileConfigProvider implements ConfigProvider {
  async load() { /* load from file */ }
  get<T>(key: string): T { /* get from file */ }
}

class CompositeConfigService {
  private providers: ConfigProvider[] = [];
  
  registerProvider(provider: ConfigProvider) {
    this.providers.push(provider);
  }
  
  async load() {
    for (const provider of this.providers) {
      await provider.load();
    }
  }
  
  get<T>(key: string): T {
    for (const provider of this.providers) {
      try {
        return provider.get<T>(key);
      } catch (e) {
        // Try next provider
      }
    }
    throw new Error(`Config not found: ${key}`);
  }
}

// Usage - add new config sources without modifying ConfigService
const configService = new CompositeConfigService();
configService.registerProvider(new EnvironmentConfigProvider());
configService.registerProvider(new FileConfigProvider());
configService.registerProvider(new RedisConfigProvider()); // NEW - supported!
```

---

### ⚠️ MEDIUM: main.ts - LLM and Chain Setup Hardcoded

**Severity:** Medium  
**Lines:** 36-49

**Issue:**
To support a different LLM provider (e.g., switch from Ollama to OpenAI), you must modify main.ts:

```typescript
// To support a new LLM provider, you must:
// 1. Change this import
import { Ollama } from "@langchain/ollama";

// 2. Modify this line
const model = new Ollama(config.ollama);

// 3. Update the config structure
// The module is CLOSED to extension
```

**Recommended Fix: Dependency Injection + Factory**
```typescript
interface LlmFactory {
  createModel(config: AppConfig): LanguageModel;
}

class OllamaLlmFactory implements LlmFactory {
  createModel(config: AppConfig): LanguageModel {
    return new Ollama(config.ollama);
  }
}

class OpenAiLlmFactory implements LlmFactory {
  createModel(config: AppConfig): LanguageModel {
    return new ChatOpenAI(config.openai);
  }
}

// Usage in main.ts
const llmFactory = config.llmProvider === 'openai' 
  ? new OpenAiLlmFactory() 
  : new OllamaLlmFactory();
  
const model = llmFactory.createModel(config);
// Now supports any LLM provider without modifying main.ts!
```

---

## 3. LISKOV SUBSTITUTION PRINCIPLE (LSP)

### Current State: **GOOD COMPLIANCE**

The codebase demonstrates proper LSP adherence for the substitution relationships present.

---

### ✅ GOOD: PatchedChroma Extension

**Severity:** Good  
**Lines:** vector.ts (10-72)

**Why It's Good:**
PatchedChroma properly extends Chroma without violating LSP:

```typescript
class PatchedChroma extends Chroma {
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ) {
    // Properly overrides parent behavior
    // Returns the same type as parent
    // Maintains the contract (returns [Document, number][])
  }
  
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: ChromaLibArgs
  ): Promise<PatchedChroma> {
    // Properly returns the subtype
  }
}
```

**Why This Respects LSP:**
1. **Return Type Compatibility:** `similaritySearchVectorWithScore()` returns exactly what the parent does
2. **Precondition Preservation:** Doesn't strengthen preconditions (parameters are the same)
3. **Postcondition Preservation:** Maintains the same guarantees as the parent
4. **Behavior Consistency:** Only fixes a bug, doesn't change semantics

**Usage Compatibility:**
```typescript
let vectorStore: Chroma = new PatchedChroma(...);
// ✓ Works - PatchedChroma is properly substitutable for Chroma
vectorStore = await Chroma.fromDocuments(...);
// ✓ Works - can switch between implementations
```

---

### ✅ GOOD: DocumentLoader Implementations

**Severity:** Good  
**Lines:** documentLoader.ts (44-135)

**Why It's Good:**
Each loader (PDF, DOCX, CSV) properly implements the same contract:

```typescript
// All loaders follow the same pattern:
// (filePath: string) => Promise<Document[]>

async function loadPdf(filePath: string): Promise<Document[]> { }
async function loadDocx(filePath: string): Promise<Document[]> { }
function loadCsv(filePath: string): Document[] { }
// ✓ Same input type
// ✓ Same output type (Document[])
// ✓ Consistent behavior expectations
```

**LSP Compliance:**
- Callers can use any loader without knowing the implementation
- All loaders respect the contract
- None change the meaning of the operation

---

## 4. INTERFACE SEGREGATION PRINCIPLE (ISP)

### Current State: **GOOD-MEDIUM COMPLIANCE**

Interfaces are reasonably focused, but some function-level segregation issues exist.

---

### ✅ GOOD: Type Definitions

**Severity:** Good  
**Location:** types.ts (1-70)

**Why It's Good:**
Interfaces are focused and single-purpose:

```typescript
export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export interface ChromaConfig {
  url: string;
  collectionName: string;
  tenant: string;
  database: string;
}

export interface PromptsConfig {
  template: string;
  question?: string;
}

export interface WatcherConfig {
  watchFolder: string;
  watchPolling: boolean;
}

// ✓ Each interface has a single, focused purpose
// ✓ No interface contains unnecessary properties
// ✓ Clients depend only on what they use
```

**Good Design:**
- `WatcherConfig` has only watcher-related properties
- `OllamaConfig` has only Ollama-specific properties
- No bloated super-interfaces

---

### ⚠️ MEDIUM: AppConfig Aggregation

**Severity:** Medium  
**Lines:** types.ts (55-67)

**Issue:**
While individual configs are well-segregated, the aggregate `AppConfig` requires clients to depend on the entire config:

```typescript
export interface AppConfig {
  ollama: OllamaConfig;
  embeddings: OllamaEmbeddingsConfig;
  chroma: ChromaConfig;
  csv: CsvConfig;
  prompts: PromptsConfig;
  chatWindowSize: number;
  watcher: WatcherConfig;
  debug: {
    vectorTest: boolean;
  };
}
```

**Problem:**
When functions need only specific config:

```typescript
async function getRetriever(filePath?: string, clientId?: string) {
  const configService = ConfigService.getInstance(import.meta.url);
  const config = configService.getConfig();  // ← Gets ENTIRE config
  
  // But only uses:
  // - config.embeddings
  // - config.chroma
  // - config.csv
  // - config.watcher
  // - config.debug
}
```

The function depends on more than it needs.

**Recommended Fix: Inject Specific Configs**
```typescript
// Instead of injecting entire AppConfig
function getRetriever(filePath?: string, clientId?: string) {
  const config = configService.getConfig();  // ← 8 properties
}

// Better: Create focused interfaces
interface RetrieverConfig {
  embeddings: OllamaEmbeddingsConfig;
  chroma: ChromaConfig;
  csv: CsvConfig;
  watcher: WatcherConfig;
  debug: DebugConfig;
}

// And inject only what's needed
function getRetriever(
  retrieverConfig: RetrieverConfig,
  filePath?: string,
  clientId?: string
) {
  // Only depends on what it needs
}
```

---

### ⚠️ MEDIUM: Validation Functions as Separate Concerns

**Severity:** Medium  
**Location:** validation.ts (1-118)

**Issue:**
Validation functions handle multiple concerns:

```typescript
export function sanitizeQuestion(input: string, maxLength: number = 5000): string
export function validateFilePath(providedPath: string, baseDir: string): string
export function validateQuestion(question: string): { valid: boolean; error?: string }
```

**Problem:**
These are utilities used in different contexts, but a client importing from validation.ts gets all three. Better to segregate:

```typescript
// interface Sanitizer
interface Sanitizer {
  sanitize(input: string): string;
}

// interface Validator
interface Validator<T> {
  validate(input: T): ValidationResult;
}

export class QuestionSanitizer implements Sanitizer {
  sanitize(input: string): string { }
}

export class QuestionValidator implements Validator<string> {
  validate(input: string): ValidationResult { }
}

export class FilePathValidator implements Validator<FilePathValidationInput> {
  validate(input: FilePathValidationInput): ValidationResult { }
}
```

---

## 5. DEPENDENCY INVERSION PRINCIPLE (DIP)

### Current State: **MEDIUM-LOW COMPLIANCE**

Classes and functions depend too heavily on concrete implementations rather than abstractions.

---

### ❌ CRITICAL: main.ts - Direct Concrete Dependencies

**Severity:** Critical  
**Lines:** main.ts (2-12, 36, 51-54)

**Issues:**
The main function depends directly on concrete implementations:

```typescript
// ❌ Direct concrete dependencies
import { Ollama } from "@langchain/ollama";           // Concrete Ollama
import { ChatPromptTemplate, MessagesPlaceholder } 
  from "@langchain/core/prompts";                     // Concrete ChatPromptTemplate
import { RunnableWithMessageHistory } 
  from "@langchain/core/runnables";                   // Concrete RunnableWithMessageHistory
import { InMemoryChatMessageHistory } 
  from "@langchain/core/chat_history";                // Concrete InMemory history
import * as readline from "readline/promises";       // Concrete readline
import { sanitizeQuestion, validateQuestion } 
  from "./validation.js";                             // Concrete functions

// Then used directly:
const messageHistory = new InMemoryChatMessageHistory();  // ← Direct instantiation
const model = new Ollama(config.ollama);                  // ← Direct instantiation
const prompt = ChatPromptTemplate.fromMessages(...);      // ← Direct instantiation
const chain = new RunnableWithMessageHistory({...});      // ← Direct instantiation
const rl = readline.createInterface({...});               // ← Direct instantiation
```

**Why This Is Bad:**
1. **Testing:** Cannot mock Ollama to test with a different LLM
2. **Extensibility:** Cannot switch to a different LLM provider without rewriting main.ts
3. **Message History:** Cannot use a persistent history without rewriting the code
4. **Validation:** Cannot use different validation strategies

**Impact:**
- To use OpenAI instead of Ollama: must modify main.ts
- To use persistent message history: must modify main.ts
- To use different validation rules: must modify main.ts
- To test with mock LLM: must modify main.ts

**Recommended Fix: Dependency Injection**
```typescript
// Define abstractions
interface LanguageModel {
  invoke(input: string): Promise<string>;
}

interface MessageHistoryProvider {
  get(): ChatMessageHistory;
  clear(): Promise<void>;
}

interface InputValidator {
  validate(input: string): ValidationResult;
}

interface InputSanitizer {
  sanitize(input: string): string;
}

interface UserInputHandler {
  getInput(prompt: string): Promise<string>;
}

// Implementations
class OllamaModel implements LanguageModel {
  constructor(private config: OllamaConfig, private model: Ollama) {}
  async invoke(input: string): Promise<string> { /* ... */ }
}

class InMemoryHistoryProvider implements MessageHistoryProvider {
  private history = new InMemoryChatMessageHistory();
  get() { return this.history; }
  async clear() { await this.history.clear(); }
}

class QuestionValidator implements InputValidator {
  validate(input: string): ValidationResult { /* ... */ }
}

class QuestionSanitizer implements InputSanitizer {
  sanitize(input: string): string { /* ... */ }
}

class ReadlineInputHandler implements UserInputHandler {
  private rl: readline.Interface;
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  async getInput(prompt: string): Promise<string> {
    return this.rl.question(prompt);
  }
  close() { this.rl.close(); }
}

// Factory for dependency creation
class ServiceFactory {
  createLanguageModel(config: AppConfig): LanguageModel {
    const ollama = new Ollama(config.ollama);
    return new OllamaModel(config.ollama, ollama);
  }
  
  createMessageHistoryProvider(): MessageHistoryProvider {
    return new InMemoryHistoryProvider();
  }
  
  createInputValidator(): InputValidator {
    return new QuestionValidator();
  }
  
  createInputSanitizer(): InputSanitizer {
    return new QuestionSanitizer();
  }
  
  createUserInputHandler(): UserInputHandler {
    return new ReadlineInputHandler();
  }
}

// Now main.ts depends on abstractions, not concrete implementations
async function main() {
  const config = ConfigService.getInstance(import.meta.url).getConfig();
  const factory = new ServiceFactory();
  
  // Inject abstractions
  const model = factory.createLanguageModel(config);
  const historyProvider = factory.createMessageHistoryProvider();
  const validator = factory.createInputValidator();
  const sanitizer = factory.createInputSanitizer();
  const inputHandler = factory.createUserInputHandler();
  
  // Use abstractions - can now swap implementations
  const userInput = await inputHandler.getInput("Question: ");
  const { valid } = validator.validate(userInput);
  const sanitized = sanitizer.sanitize(userInput);
  const response = await model.invoke(sanitized);
}
```

---

### ❌ HIGH: vector.ts - Direct OllamaEmbeddings Dependency

**Severity:** High  
**Lines:** 136

**Issue:**
```typescript
const embeddings = new OllamaEmbeddings(config.embeddings);
```

This directly depends on the concrete `OllamaEmbeddings` class. To use a different embedding provider (e.g., OpenAI embeddings), must modify vector.ts.

**Recommended Fix:**
```typescript
interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private ollama: OllamaEmbeddings) {}
  async embedQuery(text: string): Promise<number[]> { /* ... */ }
  async embedDocuments(texts: string[]): Promise<number[][]> { /* ... */ }
}

// In getRetriever, inject the embedding provider
async function getRetriever(
  embeddingProvider: EmbeddingProvider,  // ← Injection
  filePath?: string,
  clientId?: string
) {
  // Use abstraction
  const vectorStore = await PatchedChroma.fromDocuments(
    documents,
    embeddingProvider,  // ← Works with any embedding provider
    chromaConfig
  );
}
```

---

### ❌ HIGH: ConfigService - Hard Dependency on File System

**Severity:** High  
**Lines:** 176-180

**Issue:**
```typescript
private loadPromptsConfig(): PromptsConfig {
  const fullPath = resolveFromRoot(
    promptsConfigPath,
    this.importMetaUrl
  );
  const content = readFileSync(fullPath, "utf-8");  // ← Direct file system dependency
  const config = JSON.parse(content);               // ← Direct JSON dependency
}
```

ConfigService directly depends on:
- File system APIs (`readFileSync`)
- JSON parsing logic

**Problem:**
- Cannot use different config sources (database, remote API, environment)
- Cannot test without file system
- Cannot use async file operations

**Recommended Fix:**
```typescript
interface ConfigSource {
  load(path: string): Promise<PromptsConfig>;
}

class FileConfigSource implements ConfigSource {
  async load(path: string): Promise<PromptsConfig> {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content);
  }
}

class RemoteConfigSource implements ConfigSource {
  async load(path: string): Promise<PromptsConfig> {
    const response = await fetch(path);
    return response.json();
  }
}

class ConfigService {
  constructor(private configSource: ConfigSource) {}
  
  async loadPromptsConfig(path: string): Promise<PromptsConfig> {
    return this.configSource.load(path);  // ← Uses abstraction
  }
}
```

---

### ⚠️ MEDIUM: DocumentLoader - validateFilePath Direct Call

**Severity:** Medium  
**Location:** vector.ts (164)

**Issue:**
```typescript
const validatedPath = validateFilePath(docPath, allowedBaseDir);
```

This directly depends on the `validateFilePath` function. To use different validation logic, must change this line.

**Recommended Fix:**
```typescript
interface PathValidator {
  validate(path: string, baseDir: string): string;
}

class DefaultPathValidator implements PathValidator {
  validate(path: string, baseDir: string): string {
    return validateFilePath(path, baseDir);
  }
}

// Inject validator
async function getRetriever(
  pathValidator: PathValidator,  // ← Injection
  filePath?: string,
  clientId?: string
) {
  const validatedPath = pathValidator.validate(docPath, allowedBaseDir);
}
```

---

## Summary Table

| Principle | Status | Severity | Count |
|-----------|--------|----------|-------|
| **SRP** | Violated | Critical: 2, High: 2, Medium: 1 | 5 issues |
| **OCP** | Violated | Critical: 1, High: 2, Medium: 1 | 4 issues |
| **LSP** | Good | None | ✓ Compliant |
| **ISP** | Good | Medium: 2 | 2 issues |
| **DIP** | Violated | Critical: 1, High: 3, Medium: 1 | 5 issues |
| **Overall** | **6.2/10** | | |

---

## Priority Recommendations

### Phase 1 (Critical): Address DIP Violations
1. **Extract service factory classes** (main.ts)
2. **Implement dependency injection** for LLM, history, validation
3. **Create interfaces** for embedding provider and config sources
4. **Estimated Effort:** 3-4 hours

### Phase 2 (High): Refactor SRP Violations
1. **Break down main() function** into 5+ classes
2. **Decompose ConfigService** into separate providers
3. **Extract RetrieverFactory** from vector.ts
4. **Estimated Effort:** 4-5 hours

### Phase 3 (High): Implement OCP
1. **Add strategy pattern** for document loaders
2. **Create configuration registry** for dynamic configs
3. **Add factory abstractions** for LLM providers
4. **Estimated Effort:** 3-4 hours

### Phase 4 (Medium): Improve ISP
1. **Create focused config interfaces** for each function
2. **Separate validation utilities** into focused classes
3. **Estimated Effort:** 2-3 hours

---

## Positive Highlights

✅ **Strong Points:**
1. **Type Safety:** Excellent use of TypeScript interfaces (types.ts)
2. **Security Focus:** Good validation and sanitization functions
3. **Documentation:** Clear comments explaining intent
4. **LSP Compliance:** PatchedChroma properly extends Chroma without violations
5. **Error Handling:** Proper try-catch blocks and error messages
6. **Configuration Management:** Centralized ConfigService singleton is well-intentioned

---

## Refactoring Priority Matrix

```
        Impact
           ▲
    High  │  OCP (Document Loaders)   DIP (Main Function)
           │     SRP (ConfigService)   DIP (Vector Store)
           │
    Med   │  ISP (AppConfig)          SRP (getRetriever)
           │  DIP (File System)
           │
    Low   │
           └──────────────────────────────────────▶ Effort
              Low              High        
```

**Recommended Approach:** Start with **DIP violations in main.ts** (high impact, manages dependencies for everything else), then tackle **SRP violations in ConfigService** (high impact on maintainability).

