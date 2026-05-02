import mammoth from "mammoth";

export const extractDocumentHtml = async (
  file: File
): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml({
    arrayBuffer,
  });

  return result.value;
};