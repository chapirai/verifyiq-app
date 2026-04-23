type Dot = { x: number; y: number; r: number; opacity: number };

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 520;

const frame = {
  left: Math.round(VIEWBOX_WIDTH * 0.1),
  right: Math.round(VIEWBOX_WIDTH * 0.9),
  top: Math.round(VIEWBOX_HEIGHT * 0.12),
  bottom: Math.round(VIEWBOX_HEIGHT * 0.85),
};

function curveY(x: number): number {
  const t = (x - frame.left) / (frame.right - frame.left);
  const clamped = Math.max(0, Math.min(1, t));
  return frame.bottom - (Math.pow(clamped, 1.45) * (frame.bottom - frame.top));
}

function rawDots(): Dot[] {
  const rows = 7;
  const cols = 5;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = frame.left + 18 + c * 40 + (r % 2) * 8;
      const y = frame.bottom - 12 - r * 42 + (c % 2) * 7;
      dots.push({ x, y, r: 3, opacity: 0.25 + ((r + c) % 3) * 0.03 });
    }
  }
  return dots;
}

function structuredClusters(): Dot[] {
  const centers = [
    { x: 420, y: curveY(420) + 8 },
    { x: 500, y: curveY(500) + 4 },
    { x: 560, y: curveY(560) - 2 },
    { x: 610, y: curveY(610) - 8 },
  ];
  const offsets = [
    { x: -8, y: -8 },
    { x: 8, y: -8 },
    { x: -8, y: 8 },
    { x: 8, y: 8 },
    { x: 0, y: 0 },
  ];
  const dots: Dot[] = [];
  centers.forEach((center, i) => {
    offsets.slice(0, 4 + (i % 2)).forEach((off, j) => {
      dots.push({
        x: center.x + off.x,
        y: center.y + off.y,
        r: 4,
        opacity: 0.45 + (j % 3) * 0.08,
      });
    });
  });
  return dots;
}

function verifiedDots(): Dot[] {
  const xs = [700, 740, 780, 822, 860, 890];
  return xs.map((x, i) => ({
    x,
    y: curveY(x) - (i % 2 === 0 ? 2 : 8),
    r: i === 2 || i === 4 ? 6 : 5,
    opacity: 0.9,
  }));
}

function DotCloud({ dots }: { dots: Dot[] }) {
  return (
    <g aria-label="data points">
      {dots.map((d, i) => (
        <circle key={`${d.x}-${d.y}-${i}`} cx={d.x} cy={d.y} r={d.r} fill="currentColor" fillOpacity={d.opacity} />
      ))}
    </g>
  );
}

export function DataMaturityGraph() {
  const raw = rawDots();
  const structured = structuredClusters();
  const verified = verifiedDots();
  const keyNodeX = 650;
  const keyNodeY = curveY(keyNodeX) - 4;

  return (
    <div className="mt-6 w-full rounded-[8px] border border-foreground/15 px-12 py-10">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-[88%] min-h-[420px] w-full"
        role="img"
        aria-label="Graph showing progression from unstructured data to decision-ready outputs"
      >
        <g aria-label="axes" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1">
          <line x1={frame.left} y1={frame.bottom} x2={frame.right} y2={frame.bottom} />
          <line x1={frame.left} y1={frame.bottom} x2={frame.left} y2={frame.top} />
        </g>

        <g aria-label="axis labels" fill="currentColor">
          <text x={(frame.left + frame.right) / 2} y={frame.bottom + 52} textAnchor="middle" fontSize="12" letterSpacing="0.08em">
            DATA MATURITY
          </text>
          <text x={frame.left + (frame.right - frame.left) * 0.1} y={frame.bottom + 28} textAnchor="middle" fontSize="12" fillOpacity="0.7">
            Raw
          </text>
          <text x={frame.left + (frame.right - frame.left) * 0.5} y={frame.bottom + 28} textAnchor="middle" fontSize="12" fillOpacity="0.7">
            Structured
          </text>
          <text x={frame.left + (frame.right - frame.left) * 0.9} y={frame.bottom + 28} textAnchor="middle" fontSize="12" fillOpacity="0.7">
            Verified
          </text>

          <text
            x={36}
            y={(frame.top + frame.bottom) / 2}
            textAnchor="middle"
            fontSize="12"
            letterSpacing="0.08em"
            transform={`rotate(-90 36 ${(frame.top + frame.bottom) / 2})`}
          >
            DECISION CONFIDENCE
          </text>
          <text x={frame.left - 28} y={frame.bottom + 4} textAnchor="end" fontSize="12" fillOpacity="0.7">
            Low
          </text>
          <text x={frame.left - 28} y={frame.top + 4} textAnchor="end" fontSize="12" fillOpacity="0.7">
            High
          </text>
        </g>

        <g aria-label="confidence progression curve">
          <path
            d={`M ${frame.left + 10} ${frame.bottom - 10} C 280 430, 430 300, 590 200 C 710 126, 810 84, ${frame.right - 8} ${frame.top + 8}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </g>

        <g aria-label="raw unstructured data points">
          <DotCloud dots={raw} />
          <text x={frame.left + 8} y={frame.bottom - 320} fontSize="12" fillOpacity="0.6">
            Unstructured data
          </text>
        </g>

        <g aria-label="structured clustered data points">
          <DotCloud dots={structured} />
        </g>

        <g aria-label="unified company profile key node">
          <circle cx={keyNodeX} cy={keyNodeY} r={8} fill="currentColor" />
          <text x={keyNodeX} y={keyNodeY - 22} textAnchor="middle" fontSize="12" fontWeight="500">
            Unified Company Profile
          </text>
        </g>

        <g aria-label="verified high-confidence outputs">
          <DotCloud dots={verified} />
          <text x={904} y={150} fontSize="12" fillOpacity="0.8">
            Risk signals
          </text>
          <text x={904} y={172} fontSize="12" fillOpacity="0.8">
            Flags
          </text>
          <text x={904} y={194} fontSize="12" fillOpacity="0.8">
            Decision-ready output
          </text>
        </g>
      </svg>
    </div>
  );
}
