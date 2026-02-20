import { CalendarSettingsScreen } from "./CalendarSettingsScreen";
import { LoginScreen } from "./LoginScreen";
import { PairingScreen } from "./PairingScreen";
import { DragOverlay } from "./exporter/DragOverlay";
import { LoadingOverlay } from "./exporter/LoadingOverlay";
import { useExporter } from "./exporter/useExporter";
import { WizardLayout } from "./wizard";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  if (view === "login") {
    return <LoginScreen />;
  }

  if (view === "calendar") {
    return <CalendarSettingsScreen />;
  }

  if (view === "pairing") {
    return <PairingScreen />;
  }

  const {
    darkMode,
    rootPath,
    dragState,
    initialLoading,
    fadeOut,
    handleToggleTheme,
    handleChooseFolder,
    handleRevealFolder,
  } = useExporter();

  return (
    <>
      <LoadingOverlay visible={initialLoading} fadeOut={fadeOut} />

      <div className="bg-background min-h-screen transition-colors duration-300 flex flex-col h-screen overflow-hidden text-foreground">
        <WizardLayout
          darkMode={darkMode}
          onToggleTheme={handleToggleTheme}
          onChooseFolder={handleChooseFolder}
          onRevealFolder={handleRevealFolder}
          canReveal={Boolean(rootPath)}
        />

        <DragOverlay
          active={dragState.active}
          start={dragState.start}
          current={dragState.current}
        />
      </div>
    </>
  );
}
