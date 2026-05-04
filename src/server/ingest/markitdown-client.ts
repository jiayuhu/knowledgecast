export function createMarkItDownClient(baseUrl: string) {
  return {
    async convertUrl(url: string): Promise<string | null> {
      try {
        const res = await fetch(`${baseUrl}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (data.error) return null;
        return data.content ?? null;
      } catch {
        return null; // 优雅降级：MarkItDown 不可达
      }
    }
  };
}
