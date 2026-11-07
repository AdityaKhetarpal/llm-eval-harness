// A small dark code block. Lines starting with "#" (shell/YAML) are shown as comments.
export default function Code({ children, label }: { children: string; label?: string }) {
  const lines = children.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  return (
    <pre className="code" aria-label={label}>
      <code>
        {lines.map((line, i) => {
          const comment = line.trimStart().startsWith("#");
          return (
            <span key={i} className={comment ? "c" : undefined}>
              {line}
              {"\n"}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
