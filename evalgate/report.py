"""
REPORT: show the results to people
----------------------------------
    run_markdown       one run as Markdown
    compare_markdown   a gate decision as Markdown: written to the GitHub job summary or posted on a pull request
    run_html           one run as a single self-contained HTML page (no internet needed to open it)
"""
from __future__ import annotations

import html
import json


def _pct(x: float | None) -> str:
    return "–" if x is None else f"{x:.1%}"


def _cell(text, n: int = 70) -> str:
    s = "" if text is None else str(text)
    s = " ".join(s.split()).replace("|", "\\|")
    return s if len(s) <= n else s[: n - 1] + "…"


def run_markdown(run: dict, max_failures: int = 20) -> str:
    s = run["summary"]
    lines = [
        f"### {run['suite']}: {s['passed']}/{s['cases']} passed ({_pct(s['pass_rate'])})",
        "",
        f"Target: `{run['target']}` · {s['errors']} error(s) · {s['seconds']}s",
        "",
    ]
    if s["by_tag"]:
        lines += ["| Tag | Passed | Pass rate |", "|---|---|---|"]
        lines += [f"| {t} | {v['passed']}/{v['cases']} | {_pct(v['pass_rate'])} |" for t, v in s["by_tag"].items()]
        lines.append("")
    failures = [c for c in run["cases"] if not c["passed"]]
    if failures:
        lines += ["<details><summary>Failed cases</summary>", "", "| Case | Input | Why |", "|---|---|---|"]
        for c in failures[:max_failures]:
            why = c["error"] or next((ch["detail"] for ch in c["checks"] if not ch["passed"]), "")
            lines.append(f"| `{c['id']}` | {_cell(c['input'])} | {_cell(why)} |")
        if len(failures) > max_failures:
            lines.append(f"| … | {len(failures) - max_failures} more | |")
        lines += ["", "</details>"]
    return "\n".join(lines) + "\n"


def compare_markdown(result: dict, max_rows: int = 15) -> str:
    ok = result["verdict"] == "PASS"
    b, c = result["baseline"], result["candidate"]
    icon = "✅" if ok else "❌"
    lines = [
        f"## {icon} Evalgate: {result['verdict']} ({result['suite']})",
        "",
        "| | Baseline | Candidate | Change |",
        "|---|---|---|---|",
        f"| Pass rate | {_pct(b['pass_rate'])} ({b['passed']}/{b['cases']}) | {_pct(c['pass_rate'])} "
        f"({c['passed']}/{c['cases']}) | {result['delta']:+.1%} |",
        f"| Newly failing | | {len(result['newly_failing'])} | |",
        f"| Newly passing | | {len(result['newly_passing'])} | |",
        "",
        f"Baseline: `{b['label']}` · Candidate: `{c['label']}`",
        "",
    ]
    if result["reasons"]:
        lines += ["**Why it failed:**", ""] + [f"- {r}" for r in result["reasons"]] + [""]
    if result["by_tag"]:
        lines += ["| Tag | Baseline | Candidate |", "|---|---|---|"]
        for tag, v in result["by_tag"].items():
            lines.append(f"| {tag} | {_pct(v['before'])} | {_pct(v['after'])} |")
        lines.append("")
    if result["newly_failing"]:
        lines += ["<details open><summary>Cases that broke</summary>", "", "| Case | Input | Why |", "|---|---|---|"]
        for ch in result["newly_failing"][:max_rows]:
            lines.append(f"| `{ch['id']}` | {_cell(ch['input'])} | {_cell(ch['why'])} |")
        lines += ["", "</details>", ""]
    if result["newly_passing"]:
        lines += ["<details><summary>Cases that got fixed</summary>", "", "| Case | Input |", "|---|---|"]
        for ch in result["newly_passing"][:max_rows]:
            lines.append(f"| `{ch['id']}` | {_cell(ch['input'])} |")
        lines += ["", "</details>"]
    return "\n".join(lines) + "\n"


def run_html(run: dict) -> str:
    """A single HTML file with a filterable table of every case."""
    s = run["summary"]
    data = json.dumps(run["cases"], ensure_ascii=False, default=str).replace("</", "<\\/")
    title = html.escape(f"{run['suite']} · {s['passed']}/{s['cases']} passed")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
:root{{--bg:#f7f6f2;--ink:#1d1c1a;--muted:#6b6862;--line:#dedbd3;--pass:#1f7a4d;--fail:#b3261e;--card:#fff}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151412;--ink:#ecebe7;--muted:#a19e97;--line:#34322e;--pass:#4cc48a;--fail:#ff7a6e;--card:#1d1c19}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:24px 16px}}
h1{{font-size:22px;margin:0 0 4px}} .muted{{color:var(--muted)}}
.bar{{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}} button{{border:1px solid var(--line);background:var(--card);
color:var(--ink);padding:6px 12px;border-radius:999px;cursor:pointer}} button.on{{background:var(--ink);color:var(--bg)}}
details{{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:10px 14px}}
summary{{cursor:pointer;display:flex;gap:10px;align-items:baseline}} .tag{{font-weight:700}}
.pass{{color:var(--pass)}} .fail{{color:var(--fail)}} pre{{white-space:pre-wrap;word-break:break-word;
background:var(--bg);padding:10px;border-radius:8px;font:13px/1.45 ui-monospace,monospace}}
</style></head><body><main>
<h1>{html.escape(run['suite'])}</h1>
<div class="muted">{s['passed']}/{s['cases']} passed ({_pct(s['pass_rate'])}) · target {html.escape(run['target'])}
 · {html.escape(run['created_at'])}</div>
<div class="bar"><button class="on" data-f="all">All</button><button data-f="fail">Failed</button>
<button data-f="pass">Passed</button></div><div id="list"></div></main>
<script>
const cases={data};
const esc=t=>String(t??"").replace(/[&<>]/g,c=>({{"&":"&amp;","<":"&lt;",">":"&gt;"}}[c]));
function draw(f){{document.getElementById("list").innerHTML=cases.filter(c=>f==="all"||(f==="pass")===c.passed)
.map(c=>`<details><summary><span class="tag ${{c.passed?"pass":"fail"}}">${{c.passed?"PASS":"FAIL"}}</span>
<b>${{esc(c.id)}}</b><span>${{esc(typeof c.input==="string"?c.input:JSON.stringify(c.input))}}</span></summary>
${{c.error?`<p class="fail">${{esc(c.error)}}</p>`:""}}
${{c.checks.map(k=>`<div><span class="${{k.passed?"pass":"fail"}}">${{esc(k.type)}}</span> — ${{esc(k.detail)}}</div>`).join("")}}
<p class="muted">Answer</p><pre>${{esc(c.output)}}</pre>
${{c.expected!=null?`<p class="muted">Expected</p><pre>${{esc(typeof c.expected==="string"?c.expected:JSON.stringify(c.expected,null,2))}}</pre>`:""}}
</details>`).join("")}}
document.querySelectorAll("button").forEach(b=>b.onclick=()=>{{document.querySelectorAll("button")
.forEach(x=>x.classList.remove("on"));b.classList.add("on");draw(b.dataset.f)}});draw("all");
</script></body></html>
"""
