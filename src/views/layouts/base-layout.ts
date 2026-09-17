import { html, type HtmlEscapedString } from "../../framework/html/html.ts";

export interface LayoutOptions {
  title?: string;
  bodyClass?: string;
  content: HtmlEscapedString | string;
  scripts?: HtmlEscapedString;
}

export function baseLayout(
  options: LayoutOptions,
): HtmlEscapedString {
  const {
    title = "Writasaurus",
    bodyClass = "",
    content,
    scripts = html``,
  } = options;

  return html`
    <!doctype html>
    <html lang="en" data-theme="auto">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="theme-color" content="#f7f4ef">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..900;1,400..900&display=swap">
        <title>${title}</title>
        ${scripts}
      </head>
      <body class="${bodyClass}">
        ${content}
      </body>
    </html>
  `;
}
