import { html } from "../../framework/html/html.ts";
import { createView } from "../../framework/html/template.ts";
import { baseLayout } from "../../views/layouts/base-layout.ts";

type Props = {
  title: string;
  isDesktop: boolean;
};

export const editorView = createView((ctx, props: Props) => {
  return baseLayout({
    title: props.title,
    bodyClass: "editor-mode",
    scripts: html`
      <link rel="stylesheet" href="${ctx.asset("features/editor/editor.client.css")}">
      <script type="module" src="${ctx.asset("features/editor/editor.client.ts")}"></script>
      ${props.isDesktop
        ? html`<script type="module" src="${
          ctx.asset("features/editor/client/writing-assistance.client.ts")
        }"></script>`
        : ""}
    `,
    content: html`<editor-app></editor-app>`,
  });
});
