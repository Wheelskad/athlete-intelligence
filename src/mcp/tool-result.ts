export function toolResult(output: object) {
  return {
    structuredContent: output as Record<string, unknown>,
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
  };
}
