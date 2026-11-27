import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { type HeatmapCell } from '../lib/climate';
import {
  drawHeatmap,
  HEATMAP_LEFT_LABELS,
  HEATMAP_STEP,
  HEATMAP_TOP_LABELS,
  heatmapFirstWeekday,
  heatmapSize,
} from '../lib/climate-draw';

function cellText(cell: HeatmapCell): string {
  if (cell.temp === null) return `${cell.date}: no data`;
  if (cell.mean === null) return `${cell.date}: ${cell.temp.toFixed(1)}°C`;
  const delta = cell.temp - cell.mean;
  const direction = delta > 0 ? 'above' : 'below';
  if (cell.hottestOnRecord) {
    return `${cell.date}: was ${cell.temp.toFixed(1)}° — hottest day on record for this date (historical average ${cell.mean.toFixed(1)}°)`;
  }
  return `${cell.date}: was ${cell.temp.toFixed(1)}° which is ${Math.abs(delta).toFixed(1)}° ${direction} the historical average of ${cell.mean.toFixed(1)}°`;
}

/**
 * Calendar heatmap drawn to canvas. The drawing itself lives in the pure
 * `drawHeatmap()` helper (src/lib/climate-draw.ts) so the 3D projector can wrap
 * the very same function in a CanvasTexture — one source of truth for the
 * cells, labels and colors (REWORK_PLAN §4.4). An accessible table mirror of
 * every cell is rendered visually hidden alongside the canvas; jsdom-less
 * canvas contexts degrade gracefully.
 */
export function HeatmapCanvas({
  cells,
  year,
}: {
  cells: HeatmapCell[];
  year: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // GitHub-style layout: columns are weeks starting from Jan 1's week.
  const firstWeekday = heatmapFirstWeekday(year);
  const { width, height } = heatmapSize(cells, year);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // e.g. jsdom without canvas support
    drawHeatmap(ctx, cells, year);
  }, [cells, year]);

  const onMouseMove = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const column = Math.floor((x - HEATMAP_LEFT_LABELS) / HEATMAP_STEP);
    const row = Math.floor((y - HEATMAP_TOP_LABELS) / HEATMAP_STEP);
    if (column < 0 || row < 0 || row > 6) {
      setTooltip(null);
      return;
    }
    const index = column * 7 + row - firstWeekday;
    const cell = cells[index];
    if (!cell) {
      setTooltip(null);
      return;
    }
    setTooltip({ x, y, text: cellText(cell) });
  };

  return (
    <figure className="relative overflow-x-auto">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={`Historical weather heatmap for ${year}. Each day is colored by how far its mean temperature was from the 30-year average for that date. A full data table follows for screen readers.`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTooltip(null)}
        className="block max-w-none"
      />
      {tooltip && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20 max-w-xs bg-p5-black px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.text}
        </div>
      )}
      <figcaption className="sr-only">
        <table>
          <caption>
            Daily mean temperatures for {year} versus the 30-year average
          </caption>
          <tbody>
            {cells.map((cell) => (
              <tr key={cell.date}>
                <th scope="row">{cell.date}</th>
                <td>{cellText(cell)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
