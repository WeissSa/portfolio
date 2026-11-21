import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { LEVEL_COLORS, type HeatmapCell } from '../lib/climate';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const TOP_LABELS = 16;
const LEFT_LABELS = 22;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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
 * Calendar heatmap drawn to canvas (same canvas is reused as the projector
 * CanvasTexture in 3D mode later — REWORK_PLAN §4.4). An accessible table
 * mirror of every cell is rendered visually hidden alongside it; jsdom-less
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
  const firstWeekday = new Date(year, 0, 1).getDay();
  const weeks = Math.ceil((cells.length + firstWeekday) / 7);
  const width = LEFT_LABELS + weeks * STEP;
  const height = TOP_LABELS + 7 * STEP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // e.g. jsdom without canvas support

    ctx.clearRect(0, 0, width, height);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';

    // Month labels along the top.
    let lastMonth = -1;
    cells.forEach((cell, index) => {
      const month = Number(cell.date.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        const column = Math.floor((index + firstWeekday) / 7);
        ctx.fillText(MONTH_LABELS[month] ?? '', LEFT_LABELS + column * STEP, 2);
        lastMonth = month;
      }
    });

    // Weekday labels (Mon/Wed/Fri).
    [1, 3, 5].forEach((weekday) => {
      ctx.fillText(
        WEEKDAY_LABELS[weekday]!,
        0,
        TOP_LABELS + weekday * STEP + 1,
      );
    });

    // Cells.
    cells.forEach((cell, index) => {
      const column = Math.floor((index + firstWeekday) / 7);
      const row = (index + firstWeekday) % 7;
      ctx.fillStyle = LEVEL_COLORS[cell.level] ?? LEVEL_COLORS[0]!;
      ctx.fillRect(
        LEFT_LABELS + column * STEP,
        TOP_LABELS + row * STEP,
        CELL,
        CELL,
      );
    });
  }, [cells, year, firstWeekday, width, height]);

  const onMouseMove = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const column = Math.floor((x - LEFT_LABELS) / STEP);
    const row = Math.floor((y - TOP_LABELS) / STEP);
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
