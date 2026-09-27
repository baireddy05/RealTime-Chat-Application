// Sandboxed code execution via the free Wandbox API (https://wandbox.org).
// No key needed, CORS-enabled for browser use. Explicit user action only.
// (Piston's public API went whitelist-only, so it can no longer serve us.)

// Our composer language ids -> exact pinned Wandbox compilers (verified
// against /api/list.json). Pinned releases only — `-head` images move and
// break (e.g. gcc-head-pp preprocesses instead of compiling).
const LANGUAGE_COMPILERS = {
  javascript: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  python: "cpython-3.13.8",
  java: "openjdk-jdk-21+35",
  cpp: "gcc-13.2.0",
  go: "go-1.23.2",
  rust: "rust-1.82.0",
  bash: "bash",
  sql: "sqlite-3.46.1",
};

export const isRunnableLanguage = (lang) => {
  if (typeof lang !== "string") return false;
  return !!LANGUAGE_COMPILERS[lang.trim().toLowerCase()];
};

let compilersCache = null;
let compilersAt = 0;

const getCompilers = async () => {
  if (compilersCache && Date.now() - compilersAt < 60 * 60 * 1000) return compilersCache;
  const res = await fetch("https://wandbox.org/api/list.json");
  if (!res.ok) throw new Error(`compiler list ${res.status}`);
  compilersCache = await res.json();
  compilersAt = Date.now();
  return compilersCache;
};

const pickCompiler = (compilers, langId) => {
  const pinned = LANGUAGE_COMPILERS[langId];
  const names = new Set((compilers || []).map((c) => c.name));
  if (pinned && names.has(pinned)) return pinned;
  // Fallback: any compiler for the language, preferring stable releases.
  const aliases = { cpp: ["c++", "cpp"], bash: ["bash script"], sql: ["sql"] };
  const pool = (compilers || []).filter(
    (c) =>
      (c.language || "").toLowerCase() === langId ||
      (aliases[langId] || []).includes((c.language || "").toLowerCase())
  );
  const stable = pool.filter((c) => !/head|master|trunk/i.test(c.name || ""));
  return (stable[0] || pool[0])?.name || null;
};

// Wandbox compiles Java as prog.java, so `public class X` is rejected.
// Dropping `public` keeps semantics identical for single-file runs.
const adaptSource = (langId, code) => {
  if (langId === "java") {
    return code.replace(/public\s+class\s+(\w+)/, "class $1");
  }
  return code;
};

/**
 * Run source code. Returns { stdout, stderr, output, code, signal, ms, language, compiler }.
 * Throws with a human-readable message on network/API failure.
 */
export const runCode = async (language, source, stdin = "") => {
  const langId = String(language || "").trim().toLowerCase();
  if (!LANGUAGE_COMPILERS[langId]) throw new Error("This language can't be executed here.");
  const code = String(source || "");
  if (!code.trim()) throw new Error("Nothing to run.");
  if (code.length > 30000) throw new Error("Snippet too large to run (30k max).");

  const compilers = await getCompilers().catch(() => []);
  const compiler = pickCompiler(compilers, langId);
  if (!compiler) throw new Error("No runner available for this language right now.");

  const started = Date.now();
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: adaptSource(langId, code),
      compiler,
      stdin: String(stdin || "").slice(0, 4000),
      "compiler-option-raw": "",
      "runtime-option-raw": "",
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    throw new Error(`Runner responded ${res.status}. Try again.`);
  }
  const data = await res.json();
  const compileErr = [data?.compiler_output, data?.compiler_error].filter(Boolean).join("\n");
  const stdout = data?.program_output || "";
  const stderr = data?.program_error || "";
  const exitCode = data?.status !== undefined && data.status !== "" ? Number(data.status) : compileErr ? 1 : 0;
  const output =
    [compileErr, stdout, stderr].filter(Boolean).join("\n") ||
    (exitCode === 0 ? "(no output)" : "");
  return {
    stdout,
    stderr: [compileErr, stderr].filter(Boolean).join("\n"),
    output,
    code: Number.isFinite(exitCode) ? exitCode : null,
    signal: data?.signal || null,
    ms: Date.now() - started,
    language: langId,
    compiler,
  };
};
