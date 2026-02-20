# Feature Checklist (Current Desktop Scope)

## Access & Auth
- [x] Login-Seite blockiert App-Nutzung bis Moodle-Login validiert ist
- [x] Login validiert Credentials gegen Moodle (Puppeteer-Flow)
- [x] Credential-Hash (`sha256(username+password)`) wird lokal gespeichert

## Learning Explorer
- [x] Semester -> Kurse -> Wochen -> Ressourcen im UI browsen
- [x] PDF-Ressourcen im Renderer anzeigen
- [x] Interaktive Aufgaben-UI aus aktivem App-Flow entfernt

## Completion Tracking
- [x] Completion nur für Ressourcen persistieren (lokale DB `progress`)
- [x] Folder-Completion nur berechnet (rekursiv), nicht als eigene Persistenz
- [x] Custom (nicht natives) Context-Menu auf Ressourcen
- [x] Custom (nicht natives) Context-Menu auf Ordnern
- [x] Rekursives Markieren auf Ordnern (Batch-Update für Ressourcen)

## Export
- [x] Context-Menu Aktion `Exportieren...` für Ressource + Ordner
- [x] Export-Dialog mit `Save As` und `Share`
- [x] Save As exportiert ungezippt in gewählten Zielordner
- [x] Share erzeugt ZIP und öffnet macOS Share-Dialog

## Desktop Integration
- [x] Renderer + lokaler REST-Server laufen als eine Electron-App
- [x] IPC-Bridges für `exportSaveAs` und `exportShare`
- [x] Legacy Tray/Popup-Flow entfernt

## Build & Automation
- [x] Puppeteer statt Playwright für Login-Automation
- [x] Chrome-for-Testing wird automatisch geladen
- [x] macOS arm64 Release-Workflow für GitHub Releases
- [ ] Optional später: Windows x64 Installer
- [ ] Optional später: macOS Notarization/Signing
