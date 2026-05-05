import htmlDocx from "html-docx-js/dist/html-docx";
import { saveAs } from "file-saver";
import { StyleConfig } from "../types/style";
import { applyStylesToHtml } from "./applyStylesToHtml";

export const exportDocument = async (
  originalHtml: string,
  styles: StyleConfig
) => {
  try {
    const styledHtml = applyStylesToHtml(
      originalHtml,
      styles,
      { wrapPresForWord: true }
    );

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        ${styledHtml}
      </body>
      </html>
    `;

    const converted =
      htmlDocx.asBlob(fullHtml);

    saveAs(
      converted,
      "DocPolishAI-output.docx"
    );
  } catch (error) {
    console.error(
      "Export failed:",
      error
    );
  }
};