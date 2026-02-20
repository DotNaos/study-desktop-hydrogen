# Migration Memory

## Ziele
- Study-Sync und Study-Web zu einer Electron-App zusammenführen.
- Aus Study-Sync nur serverrelevante Teile behalten, alte Study-Sync-UI entfernen.
- Erst Full-Stack lokal getrennt lauffähig halten (Frontend + Backend), testen via Browser-Automation/REST.
- Danach Study-Web-Frontend in Electron-Renderer und Backend in Electron-Main integrieren.
- Deployment/remote server Pfade entfernen: alles lokal in Electron.
- Playwright durch Puppeteer ersetzen und Browser-Binary im Build/Installer sicherstellen.
- GitHub Actions für Release-Artefakte (fokus macOS arm64) aufsetzen.

## Fortschritt
- [x] Repo gescannt, Architektur identifiziert.
- [x] Relevante Skills geladen (`typescript-write`, `agent-browser` fallback via Playwright-MCP).
- [x] Alte Study-Sync-Renderer-UI durch Study-Web-Renderer ersetzt.
- [x] Server-Only-Fokus in Study-Sync-Main: Legacy Fenster/Tray-Flows entfernt.
- [x] Lokale Shared-Module für Logging/Types statt externer Workspace-Abhängigkeiten.
- [x] Study-Web-Backend-Funktionalität (`/api/task/:taskId/attempt`) in Study-Sync-Server integriert.
- [x] Frontend + Backend lokal getrennt getestet (REST + Browser-Automation gegen lokalen Server).
- [x] Electron-Integration umgesetzt (Renderer=Study-Web, Main=lokaler REST-Server).
- [x] Playwright -> Puppeteer Migration inkl. Chrome-for-Testing Download.
- [x] GitHub Workflow für macOS arm64 Installer-Release angelegt.
- [x] Feature-Checklist in Markdown erstellt (`FEATURE_CHECKLIST.md`).
- [x] Login-Gate umgesetzt (UI blockiert bis validem Moodle-Login).
- [x] Credential-Hashing und Login-via-UI/REST implementiert.
- [x] Renderer auf Ressourcen-Explorer + PDF-Viewer umgestellt.
- [x] Task-Route aus aktivem UI-Flow entfernt.
- [x] Context-Menu Actions für Ressourcen und Ordner (Complete/Export) umgesetzt.
- [x] Rekursives Completion auf Ordnern via Batch-Endpoint umgesetzt.
- [x] Export-Dialog (`Save As` ungezippt / `Share` als ZIP) umgesetzt.
- [x] Main/Preload IPC für Desktop-Export integriert.
- [x] Unit + Integration Tests erweitert (`treeUtils`, `auth`, `exportDesktop`, `startupAuth`).
- [x] E2E-Smoke via Browser-Automation durchgeführt (Login-Gate, Tree/PDF, Context-Menu, rekursives Completion, Export-Dialog).
