// Confusion matrix as a heatmap: rows = the true grade (people / execution), columns = the judge's grade.
// One hue, light -> dark by share of the row. The diagonal (agreement) is outlined.
export default function Confusion({ matrix, categories, rowTitle, colTitle }: {
  matrix: number[][];
  categories: (string | number)[];
  rowTitle: string;
  colTitle: string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="cm" aria-label={`${rowTitle} by ${colTitle}`}>
        <thead>
          <tr>
            <th />
            <th colSpan={categories.length} className="axis-title">{colTitle} →</th>
          </tr>
          <tr>
            <th className="axis-title" style={{ textAlign: "right" }}>{rowTitle} ↓</th>
            {categories.map((c) => <th key={String(c)}>{String(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0) || 1;
            return (
              <tr key={i}>
                <th style={{ textAlign: "right" }}>{String(categories[i])}</th>
                {row.map((n, j) => {
                  const share = n / total;
                  const strong = share > 0.55;
                  return (
                    <td key={j} className={`cell${i === j ? " diag" : ""}`}
                      title={`${rowTitle} ${categories[i]}, judge ${categories[j]}: ${n} of ${total} (${Math.round(share * 100)}%)`}
                      style={{
                        background: n ? `color-mix(in srgb, var(--chart) ${Math.round(12 + share * 88)}%, var(--surface))` : "var(--surface-2)",
                        color: strong ? "#fff" : "var(--ink)",
                      }}>
                      {n}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
