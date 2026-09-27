// Sandboxed code execution via the free Piston API (https://emkc.org).
// No key needed; runs server-side in containers. Explicit user action only.
const PISTON_BASE = "https://emkc.org/api/v2/piston";

// Our composer language ids -> Piston runtime names. Absent = not runnable
// (markup/data formats have no "run" semantics).
const LANGUAGE_MAP = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  cpp: "c++",
  go: "go",
  rust: "rust",
  bash: "bash",
};

export const isRunnableLanguage = (lang) =>
  typeof lang === "string" && !!LANGUAGE_MAP[lang.trim().toLowerCase()];

let runtimesCache = null;
let runtimesAt = 0;

const getRuntimes = async () => {
  if (runtimesCache && Date.now() - runtimesAt < 10 * 60 * 1000) return runtimesCache;
  const res = await fetch(`${PISTON_BASE}/runtimes`);
  if (!res.ok) throw new Error(`runtimes ${res.status}`);
  runtimesCache = await res.json();
  runtimesAt = Date.now();
  return runtimesCache;
};

/**
 * Run source code. Returns { stdout, stderr, output, code, signal, ms, language, version }.
 * Throws with a human-readable message on network/API failure.
 */
export const runCode = async (language, source, stdin = "") => {
  const lang = LANGUAGE_MAP[String(language || "").trim().toLowerCase()];
  if (!lang) throw new Error("This language can't be executed here.");
  const code = String(source || "");
  if (!code.trim()) throw new Error("Nothing to run.");
  if (code.length > 30000) throw new Error("Snippet too large to run (30k max).");

  const runtimes = await getRuntimes().catch(() => []);
  const match = (runtimes || []).find((r) => r.language === lang);
  const started = Date.now();
  const res = await fetch(`${PISTON_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: lang,
      version: match?.version || "*",
      files: [{ content: code }],
      stdin: String(stdin || "").slice(0, 4000),
      compile_timeout: 10000,
      run_timeout: 5000,
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.message || "";
    } catch {}
    throw new Error(detail || `Runner responded ${res.status}. Try again.`);
  }
  const data = await res.json();
  const run = data?.run || {};
  const combined = run.output ?? [run.stdout, run.stderr].filter(Boolean).join("\n");
  return {
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    output: combined || (run.code === 0 ? "(no output)" : ""),
    code: run.code ?? null,
    signal: run.signal || null,
    ms: Date.now() - started,
    language: data?.language || lang,
    version: data?.version || "",
  };
};
