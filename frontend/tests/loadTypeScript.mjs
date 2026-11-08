import { readFile } from "node:fs/promises";
import ts from "typescript";

const modules = new Map();
/** Loads the small, acyclic pure-TypeScript modules under test without browser or bundler globals. */
async function moduleUrl(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  let { outputText } = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  for (const match of [
    ...outputText.matchAll(/\bfrom\s+(['"])(\.[^'"]+)\1/g),
  ]) {
    const dependency = new URL(`${match[2]}.ts`, url);
    outputText = outputText.replace(
      match[0],
      `from ${JSON.stringify(await moduleUrl(dependency))}`,
    );
  }
  const compiled = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  modules.set(url.href, compiled);
  return compiled;
}
export async function loadTypeScript(url) {
  return import(await moduleUrl(url));
}
