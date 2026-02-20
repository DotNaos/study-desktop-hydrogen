
type DragOverlayProps = {
  active: boolean;
  start: { x: number; y: number };
  current: { x: number; y: number };
};

export function DragOverlay({ active, start, current }: DragOverlayProps) {
  if (!active) return null;

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: "100vw", height: "100vh" }}
    >
      <path
        d={`M ${start.x} ${start.y} C ${start.x + 50} ${start.y}, ${current.x - 50} ${current.y}, ${current.x} ${current.y}`}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="5,5"
        className="animate-pulse"
      />
      <circle cx={start.x} cy={start.y} r="4" fill="hsl(var(--primary))" />
      <circle cx={current.x} cy={current.y} r="6" fill="hsl(var(--primary))" className="animate-ping opacity-20" />
      <circle cx={current.x} cy={current.y} r="4" fill="hsl(var(--primary))" />
    </svg>
  );
}
