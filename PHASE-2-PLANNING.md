# Phase 2 Planning - Beyond MVP

**Status:** 🔵 Planning  
**Target Start:** October 2025  
**Estimated Duration:** TBD

---

## Phase 2 Goals

Build on Phase 1's stable foundation to deliver:
1. **Advanced Execution** - Conditional routing, error handling, retry logic
2. **Enhanced UX** - Undo/redo, keyboard shortcuts, bulk operations
3. **Observability** - Execution timeline, variable inspector, performance profiling
4. **Collaboration** - Real-time multi-user editing (websockets/CRDT)
5. **Polish** - Dark mode, better error toasts, visual execution feedback

---

## Candidate Features (Prioritization TBD)

### Execution Engine Enhancements
- [ ] Conditional edge routing (if/else logic based on output)
- [ ] Loop/iteration nodes (map over arrays, retry until success)
- [ ] Error boundary nodes (catch & handle execution failures)
- [ ] Parallel execution (fan-out/fan-in)
- [ ] Execution pause/resume/cancel
- [ ] Rate limiting & throttling (prevent LLM API spam)
- [ ] Execution replay (time-travel debugging)
- [ ] Transaction rollback (undo side-effects)
- [ ] Lazy execution (skip nodes until output requested)
- [ ] Incremental execution (cache unchanged subgraphs)

### UI/UX Improvements
- [ ] Undo/redo (wire up existing command pattern)
- [ ] Keyboard shortcuts (Cmd+Z, Cmd+C, Cmd+V, arrows)
- [ ] Bulk select & operations (shift+click, drag-select)
- [ ] Node search & filtering (by type, name, connected to)
- [ ] Canvas minimap with node density heatmap
- [ ] Edge labels visible on canvas (show varName)
- [ ] Visual execution progress (animated flow, node highlights)
- [ ] Execution timeline scrubber (see state at any point)
- [ ] Variable inspector panel (show all buffer contents)
- [ ] Command palette (Cmd+K quick actions)
- [ ] Toast notifications for errors (consistent UI)
- [ ] Confirmation dialogs (destructive actions)
- [ ] Node templates (save & reuse common patterns)
- [ ] Auto-layout (hierarchical, force-directed)
- [ ] Dark mode toggle
- [ ] Accessibility (keyboard nav, screen reader)

### Data & Persistence
- [ ] Export graph as JSON (backup/share)
- [ ] Import graph from JSON (restore/clone)
- [ ] Snapshot system (save/restore graph state)
- [ ] Version history (git-like diff view)
- [ ] Separate event log (move LogNode history out of props)
- [ ] Pagination for large node lists
- [ ] Indexed search (full-text across node content)
- [ ] Database backend option (PostgreSQL, SQLite)

### Collaboration & Real-time
- [ ] Websocket server (live graph updates)
- [ ] CRDT-based conflict resolution (multi-user edits)
- [ ] Cursor presence indicators (see other users)
- [ ] Comment threads on nodes (discussion)
- [ ] User roles & permissions (read/write/admin)
- [ ] Activity feed (who did what when)

### Developer Experience
- [ ] Plugin system (custom node types via npm packages)
- [ ] Node SDK (TypeScript API for node authors)
- [ ] Hot reload for schemas (watch schema dir)
- [ ] GraphQL API (alternative to REST)
- [ ] Execution profiler (flame graph, bottleneck detection)
- [ ] Debug mode (step through execution)
- [ ] Logging levels (error, warn, info, debug, trace)
- [ ] Metrics export (Prometheus, StatsD)
- [ ] Health check endpoint (readiness, liveness)

### AI-Assisted Features
- [ ] Prompt optimization suggestions (LLM node)
- [ ] Auto-suggest next node (based on graph patterns)
- [ ] Smart edge routing (avoid crossings)
- [ ] Natural language graph construction ("create a pipeline that...")
- [ ] Anomaly detection (unusual execution patterns)
- [ ] Auto-complete for variable names (in LLM prompts)

### New Node Types
- [ ] **HTTP Request** - Fetch data from APIs
- [ ] **JSON Transformer** - jq-like queries
- [ ] **Conditional** - If/else routing
- [ ] **Loop** - Iterate over arrays
- [ ] **Delay** - Sleep/wait node
- [ ] **Webhook** - Trigger via external POST
- [ ] **Email** - Send notifications
- [ ] **Database Query** - SQL/NoSQL read/write
- [ ] **Image Processing** - Resize, crop, OCR
- [ ] **Aggregator** - Collect multiple inputs before proceeding

### Testing & Quality
- [ ] Visual regression tests (Percy, Chromatic)
- [ ] Load testing (simulate 1000-node graphs)
- [ ] Fuzz testing (invalid inputs, edge cases)
- [ ] Mutation testing (kill mutants in tests)
- [ ] Coverage reporting (Istanbul, Codecov)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment (preview branches)

### Documentation & Onboarding
- [ ] Interactive tutorial (first-time user flow)
- [ ] Video demos (YouTube, Loom)
- [ ] API reference (auto-generated from code)
- [ ] Cookbook (common patterns & recipes)
- [ ] Troubleshooting guide (FAQ, known issues)
- [ ] Contributing guide (for open source)
- [ ] Release notes (changelog automation)

---

## Phase 2 Constraints

- Maintain backward compatibility with Phase 1 graphs
- No breaking schema changes (use version field)
- Keep file-based storage option (don't force DB)
- All new features must have tests
- UI changes should not regress existing flows

---

## Success Metrics (TBD)

- [ ] User can undo/redo 10 operations without lag
- [ ] Execution timeline shows 100-node graph clearly
- [ ] Websocket updates arrive <100ms latency
- [ ] Plugin system used by 3rd party developers
- [ ] Dark mode adoption >50% of users
- [ ] Test coverage remains >80%

---

## Next Steps

1. **Community Feedback** - Gather user pain points & feature requests
2. **Prioritization Workshop** - Rank features by impact/effort
3. **Technical Spikes** - Prototype risky items (CRDT, plugin system)
4. **Roadmap Draft** - Timeline with milestones
5. **Team Allocation** - Assign features to developers

---

## Open Questions

- Should we introduce a database now, or keep file-based for Phase 2?
- What's the minimum viable collaboration feature (comments vs real-time edits)?
- Do we need a design system refresh before adding more UI?
- Should plugins be sandboxed (iframe, WebWorker) or trusted code?
- How do we balance new features vs technical debt paydown?

---

_Phase 2 planning initiated October 2, 2025._
