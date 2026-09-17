import { type HtmlEscapedString } from "../html/html.ts";

export const createHtmlResponse = <T extends Record<string, unknown>>(
  template: HtmlEscapedString,
  status: number = 200,
): Response => {
  return new Response(template.toString(), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    },
  });
};
export const createJsonResponse = <T extends Record<string, unknown>>(
  data: T,
  status: number = 200,
): Response => {
  return Response.json(data, { status });
};
