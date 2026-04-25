export function parseMarkdownUpload(input: string) {
  const lines = input.trim().split(/\r?\n/);
  const heading = lines.find((line) => line.startsWith("# "));
  const title = heading ? heading.slice(2).trim() : "Untitled";
  const body = lines
    .filter((line) => line !== heading)
    .join("\n")
    .trim();

  return {
    title,
    body
  };
}
