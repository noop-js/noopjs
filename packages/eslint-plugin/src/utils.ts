export function getClientDirective(sourceText: string): string | null {
  const match = sourceText.match(/\/\/\s*client:\s*(none|resume|spa|full)\b/);
  return match ? match[1] : null;
}
