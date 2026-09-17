import { LocalLinter } from "harper";
import { slimBinaryInlined } from "npm:harper.js@2.10.0/slimBinaryInlined";
import {
  getWritingAssistanceIgnores,
  getWritingAssistancePreference,
  getWritingAssistanceWords,
  saveWritingAssistanceIgnores,
  saveWritingAssistanceWords,
} from "../../../lib/settings.ts";

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface WritingWarning {
  kind: string;
  message: string;
  problem: string;
  start: number;
  end: number;
  suggestions: string[];
}

const HIGHLIGHT_NAMES = {
  spelling: "writing-assistance-spelling",
  grammar: "writing-assistance-grammar",
} as const;

type HighlightRegistry = {
  delete(name: string): boolean;
  set(name: string, highlight: unknown): void;
};

type HighlightConstructor = new (...ranges: Range[]) => unknown;

function warningKey(warning: WritingWarning): string {
  return `${warning.kind}:${warning.problem.toLocaleLowerCase()}`;
}

function collectText(editor: HTMLElement): { source: string; segments: TextSegment[] } {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const values: string[] = [];
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    if (text) {
      segments.push({ node: node as Text, start: offset, end: offset + text.length });
      values.push(text);
      offset += text.length + 1;
    }
    node = walker.nextNode();
  }
  return { source: values.join("\n"), segments };
}

function sourceRange(warning: WritingWarning, segments: readonly TextSegment[]): Range | null {
  const segment = segments.find((candidate) =>
    warning.start >= candidate.start && warning.end <= candidate.end
  );
  if (!segment) return null;
  const range = document.createRange();
  range.setStart(segment.node, warning.start - segment.start);
  range.setEnd(segment.node, warning.end - segment.start);
  return range;
}

function setHighlights(
  warnings: readonly WritingWarning[],
  segments: readonly TextSegment[],
): void {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const Highlight = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !Highlight) return;

  registry.delete(HIGHLIGHT_NAMES.spelling);
  registry.delete(HIGHLIGHT_NAMES.grammar);

  const spellingRanges: Range[] = [];
  const grammarRanges: Range[] = [];
  for (const warning of warnings) {
    const range = sourceRange(warning, segments);
    if (!range) continue;
    if (warning.kind === "Spelling" || warning.kind === "Typo") spellingRanges.push(range);
    else grammarRanges.push(range);
  }
  if (spellingRanges.length) {
    registry.set(HIGHLIGHT_NAMES.spelling, new Highlight(...spellingRanges));
  }
  if (grammarRanges.length) registry.set(HIGHLIGHT_NAMES.grammar, new Highlight(...grammarRanges));
}

function clearHighlights(): void {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  registry?.delete(HIGHLIGHT_NAMES.spelling);
  registry?.delete(HIGHLIGHT_NAMES.grammar);
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function start(): Promise<void> {
  await customElements.whenDefined("editor-app");
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const editor = document.querySelector<HTMLElement>("#editor");
  const writingArea = document.querySelector<HTMLElement>("editor-writing-area");
  if (!editor || !writingArea || !getWritingAssistancePreference()) return;
  editor.spellcheck = false;

  const panel = document.createElement("aside");
  panel.className = "writing-assistance-panel";
  panel.setAttribute("aria-live", "polite");
  panel.textContent = "Writing assistance: loading...";
  writingArea.append(panel);

  const linter = new LocalLinter({ binary: slimBinaryInlined });
  try {
    await linter.setup();
    await linter.importWords(getWritingAssistanceWords());
  } catch (error) {
    console.error("Writing assistance could not initialize.", error);
    panel.textContent = "Writing assistance is unavailable.";
    return;
  }

  let warnings: WritingWarning[] = [];
  let segments: TextSegment[] = [];
  let expanded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const renderPanel = () => {
    panel.replaceChildren();
    const label = warnings.length
      ? `Writing assistance: ${warnings.length} ${warnings.length === 1 ? "issue" : "issues"}`
      : "Writing assistance: no issues";
    panel.append(createButton(label, () => {
      expanded = !expanded;
      renderPanel();
    }));
    if (!expanded || !warnings.length) return;

    const list = document.createElement("ol");
    list.className = "writing-assistance-list";
    for (const warning of warnings.slice(0, 10)) {
      const item = document.createElement("li");
      const description = document.createElement("span");
      description.textContent = `${warning.problem}: ${warning.message}`;
      item.append(description);
      const actions = document.createElement("span");
      actions.className = "writing-assistance-actions";

      const suggestion = warning.suggestions[0];
      if (suggestion) {
        actions.append(createButton(`Replace with “${suggestion}”`, () => {
          const range = sourceRange(warning, segments);
          if (!range) return;
          range.deleteContents();
          range.insertNode(document.createTextNode(suggestion));
          range.commonAncestorContainer.parentNode?.normalize();
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          scheduleAnalysis();
        }));
      }

      if (warning.kind === "Spelling" || warning.kind === "Typo") {
        actions.append(createButton("Add to dictionary", async () => {
          const words = [...getWritingAssistanceWords(), warning.problem];
          saveWritingAssistanceWords(words);
          await linter.importWords(words);
          scheduleAnalysis();
        }));
      } else {
        actions.append(createButton("Ignore", () => {
          saveWritingAssistanceIgnores([...getWritingAssistanceIgnores(), warningKey(warning)]);
          scheduleAnalysis();
        }));
      }
      item.append(actions);
      list.append(item);
    }
    panel.append(list);
  };

  const analyze = async () => {
    const currentGeneration = ++generation;
    const collected = collectText(editor);
    if (!collected.source.trim()) {
      warnings = [];
      segments = collected.segments;
      clearHighlights();
      renderPanel();
      return;
    }

    try {
      const ignored = new Set(getWritingAssistanceIgnores());
      const lints = await linter.lint(collected.source, { language: "plaintext" });
      if (currentGeneration !== generation) {
        for (const lint of lints) lint.free();
        return;
      }
      warnings = lints.map((lint) => {
        const span = lint.span();
        const warning = {
          kind: lint.lint_kind(),
          message: lint.message(),
          problem: lint.get_problem_text(),
          start: Number(span.start),
          end: Number(span.end),
          suggestions: lint.suggestions().map((suggestion) => suggestion.get_replacement_text()),
        };
        lint.free();
        return warning;
      }).filter((warning) => !ignored.has(warningKey(warning)));
      segments = collected.segments;
      setHighlights(warnings, segments);
      renderPanel();
    } catch (error) {
      console.error("Writing assistance analysis failed.", error);
      warnings = [];
      clearHighlights();
      renderPanel();
    }
  };

  function scheduleAnalysis(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => void analyze(), 400);
  }

  editor.addEventListener("input", scheduleAnalysis);
  new MutationObserver(scheduleAnalysis).observe(editor, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  scheduleAnalysis();
}

void start();
