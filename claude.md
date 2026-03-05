# Development Guidelines

## Core Rules

1. **Focus on code, not documentation**
   - Don't create markdown files unless explicitly requested
   - No separate architecture docs, checklists, guides, or reports
   - Inline comments in code are sufficient for documentation (keep it short, only document complex logic)
   - Keep it concise - one consolidated doc max if necessary

2. **Don't create unnecessary files**
   - No separate analysis files (SOLID_ANALYSIS.md, CLEAN_ARCHITECTURE_ANALYSIS.md, etc.)
   - No separate checklist files (REFACTORING_CHECKLIST.md)
   - No separate guide files (REFACTORING_GUIDE.md, QUICK_REFERENCE.md)
   - Focus on implementation, not documentation

3. **Before making changes**
   - Ask clarifying questions if intent is unclear
   - Suggest most useful approach and get confirmation
   - Make changes directly, don't just describe them

4. **Git commits**
   - Don't commit anything until explicitly asked
   - When asked for commit, use dactil-agents' git commit agent to create concise messages
   - Reference workspace standards for commit conventions

5. **Use available agents from dactil-agents MCP**
   - Don't reinvent when specialized agents exist for the task
   
   **Development Agents:**
   - `angular_architect` - Angular architecture & structure
   - `clean_architecture_expert` - Clean architecture design & refactoring
   - `domain_driven_design` - Domain-driven design (DDD)
   - `solid_analyzer` - SOLID principles analysis & violations
   - `pwa_development_expert` - Progressive Web App development
   - `react_native_expert` - React Native development
   - `scss_designer` - SCSS/styling design
   - `comments_cleaner` - Code comment cleanup & documentation
   
   **Testing Agents:**
   - `angular_testing_expert` - Angular unit & integration testing
   - `angular_vitest_expert` - Angular Vitest testing
   - `playwright_expert` - E2E testing with Playwright
   - `specs_analyzer` - Test specifications analysis
   
   **Design Agents:**
   - `accessibility_expert` - Accessibility (A11y) compliance
   - `app_ui_design_expert` - UI/UX design
   - `diagram_designer` - Architecture & system diagrams
   
   **Planning & Management Agents:**
   - `project_manager` - Scrum & project management
   - `prd_generator` - Product Requirements Document generation
   - `requirements_writer` - Requirements specification writing
   - `github_issue_creator` - GitHub issue creation
   - `sprint_issue_creator` - Sprint task creation
   - `dactil_feature_analyzer` - Feature analysis
   - `i18n_localization_expert` - Internationalization & localization
   
   **Git Agents:**
   - `git_commit` - Semantic commit message generation
   - `gitflow_branching` - GitFlow branching strategy