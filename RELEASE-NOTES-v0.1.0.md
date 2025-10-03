# Release Notes - v0.1.0 (Phase 1 MVP)

**Release Date:** October 2, 2025  
**Status:** ✅ Stable  
**Codename:** Foundation

---

## 🎉 What's New

Celestial Engine v0.1.0 is the first stable release, delivering a complete graph execution environment with:

### Core Features
- **Visual Graph Editor** - Drag-and-drop canvas powered by ReactFlow
- **Schema-Driven Validation** - JSON Schema ensures data integrity
- **File-Based Persistence** - No database needed, everything is version-controllable JSON
- **Execution Engine** - Queue-based processing with middleware pipeline
- **7 Node Types** - Task, Code, LLM, ChatNode, LogNode, FileReaderNode, Group
- **LLM Integration** - Works with OpenAI, Ollama, and Anthropic models
- **Real-Time Logs** - Watch execution flow in LogNode with auto-scroll
- **File Operations** - Read files and scan directories with FileReaderNode
- **Subgraphs** - Organize complex graphs with Group nodes

### Developer Experience
- Hot reload during development
- 100+ passing tests (unit + E2E)
- Clear error messages with file paths
- Type-safe APIs with TypeScript
- Extensible middleware architecture

---

## 🚀 Quick Start

```bash
git clone https://github.com/Kirosoft/celestial_engine.git
cd celestial_engine/apps/web
npm install
npm run dev
```

Open http://localhost:3000 and start building!

---

## 📖 Documentation

- [README.md](./README.md) - Setup and architecture overview
- [PHASE-1-COMPLETE.md](./PHASE-1-COMPLETE.md) - Full feature list and metrics
- [TESTING.md](./TESTING.md) - Testing guide
- [CHANGELOG.md](./CHANGELOG.md) - Detailed change log

---

## 🎯 What Works Great

✅ Create nodes via drag-and-drop Toolbox  
✅ Connect nodes with edges (drag from handle to handle)  
✅ Edit node properties in Inspector panel  
✅ Execute LLM prompts with variable injection  
✅ View execution logs in real-time  
✅ Read files and pass content to LLM  
✅ Save/load graphs from disk  
✅ Navigate into Group subgraphs  
✅ Delete nodes/edges with keyboard shortcuts  
✅ Resize panels and persist layout  

---

## ⚠️ Known Limitations

These items are deferred to Phase 2:

- **No undo/redo** - Command pattern is scaffolded but not wired up
- **History in node props** - LogNode/ChatNode history should be in separate event log
- **Temp file cleanup** - Manual cleanup needed: `find nodes -name '*.json.tmp-*' -delete`
- **No real-time collaboration** - Refresh needed to see changes from other sessions
- **Edge labels hidden** - Variable names (varName) not shown on canvas
- **Limited keyboard shortcuts** - Only Delete, Backspace, Escape supported
- **No dark mode** - Single theme only

See full list in [PHASE-1-COMPLETE.md](./PHASE-1-COMPLETE.md#known-limitations-deferred-to-phase-2).

---

## 🔮 What's Next (Phase 2)

We're planning exciting features for the next phase:

- Undo/redo and keyboard shortcuts
- Execution timeline and variable inspector
- Real-time collaboration (websockets)
- Conditional routing and loops
- Dark mode and better error toasts
- Plugin system for custom node types

See [PHASE-2-PLANNING.md](./PHASE-2-PLANNING.md) for the full roadmap.

---

## 📊 Phase 1 By The Numbers

- **12,000** lines of code
- **7** node types
- **15** API endpoints
- **106** passing tests
- **40+** test assertions
- **8** E2E scenarios
- **10** UI components
- **2** execution middlewares

---

## 🙏 Acknowledgments

Built with:
- Next.js 14.2.5
- React 18.3.1
- ReactFlow 11.10.3
- AJV 8.17.1
- TypeScript 5.4.5

Special thanks to the open-source community for these amazing tools!

---

## 🐛 Bug Reports & Feedback

Found an issue? Have a feature request?

- Open an issue on GitHub
- Check [TESTING.md](./TESTING.md) for troubleshooting tips
- Join our community discussions

---

## 📝 License

TBD - License file coming soon.

---

**Enjoy building with Celestial Engine!** 🌟

---

_Released October 2, 2025 by the Celestial Engine team_
