# Testing Plan

## Scope
- Blocker-Login vor App-Nutzung (Moodle Credentials validieren)
- Semester -> Kurse -> Wochen -> Ressourcen browsen
- PDF in der App öffnen
- `completed` nur für Ressourcen persistieren, Ordnerstatus nur berechnet
- Custom Context Menu (nicht nativ) für Complete/Export
- Export:
- Save As: ungezippt in Zielordner
- Share: ZIP erzeugen und macOS Share-Dialog
- Entfernen der interaktiven Aufgaben-UI aus der Produktoberfläche

## Test Pyramid
- Unit Tests: Logik für Tree/Completion/Export-Planung
- Integration Tests: REST-Routen + lokale Persistenz + Export-Service
- E2E Tests: Renderer-Flow mit Login-Gate, Browsing, Context-Menu-Aktionen, PDF-Open

## Unit Tests (Vitest)
1. Completion-Berechnung
- Ressourcenstatus aus `progress` korrekt
- Ordnerstatus rekursiv korrekt berechnet
- Leere Ordner liefern keinen falschen `completed`-Status
2. Resource-Collection
- Rekursives Sammeln von Ressourcen-IDs aus Ordnern
- Nicht-Ressourcen werden nicht in Persistenz-Updates aufgenommen
3. Export-Dateipfade
- Dateinamen-Sanitizing
- Dateiendung bei Ressourcen korrekt
- Ordnerstruktur wird stabil aufgebaut

## Integration Tests (Vitest + HTTP gegen Express App)
1. Auth
- `GET /api/auth/status` liefert unauthenticated bei leerer Session
- `POST /api/auth/login` validiert Credentials und setzt Session
- Fehlerpfad bei ungültigen Credentials
2. Completion
- `POST /api/nodes/:id/completion` akzeptiert nur Leaf/Ressourcen
- `POST /api/nodes/completion/batch` akzeptiert nur Leaf/Ressourcen
- Persistenz landet in lokaler SQLite `progress`-Tabelle
3. Export
- Save-As-Export schreibt ungezippte Dateien in Zielordner
- Share-Export erzeugt ZIP im Temp-Verzeichnis
- Datei-Export (Einzelresource) erzeugt keine unnötige ZIP bei Save-As

## E2E Tests
1. Login-Gate
- App zeigt Login-Form zuerst
- Ohne gültige Credentials keine Navigation möglich
- Nach erfolgreichem Login wird Explorer geladen
2. Browse & PDF
- Baumansicht: Semester/Kurse/Wochen/Ressourcen sichtbar
- Klick auf Ressource öffnet PDF-Viewer im Renderer
3. Context Menu
- Rechtsklick auf Ressource zeigt Complete + Export
- Rechtsklick auf Ordner zeigt rekursive Complete-Option + Export
- Complete-Aktion aktualisiert UI und bleibt nach Reload erhalten
4. Export UI
- Save-As-Fluss startet Zielordner-Auswahl und exportiert ungezippt
- Share-Fluss startet ZIP-Erstellung und Share-Dialog (macOS)

## Execution Order
1. Unit + Integration zuerst grün machen
2. Dann E2E Happy Path
3. Danach E2E Fehlerpfade (invalid login, export failure)

## Definition of Done
- Alle neuen Unit/Integration-Tests grün
- E2E-Happy-Path erfolgreich auf lokaler Electron-App
- Manuelle Smoke-Prüfung:
- Login-Gate blockiert korrekt
- PDF öffnet im App-Viewer
- Completion persistiert nur auf Ressourcen
- Export Save-As/Share funktionieren wie beschrieben

## Current Results (2026-02-20)
- [x] Unit Tests grün (`treeUtils`, `startupAuth`)
- [x] Integration Tests grün (`auth` route, `exportDesktop`)
- [x] Gesamt-Testlauf grün (`npm test`: 24/24)
- [x] Build grün (`npm run build`)
- [x] E2E Smoke (Browser-Automation):
- Login-Gate sichtbar und blockierend
- Nach erfolgreichem Login: Explorer + PDF-Viewer geladen
- Context-Menu auf Ressource und Ordner vorhanden
- Ressource-Completion persistiert über Reload
- Ordner-Completion rekursiv angewendet
- Export-Dialog (`Save As`/`Share`) im UI verfügbar
