let sessionInitialized = false;

async function ensureInitialized(mcpUrl: string): Promise<void> {
  if (sessionInitialized) return;

  const initRes = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "knowledgecast", version: "1.0.0" }
      }
    })
  });

  if (!initRes.ok) {
    throw new Error(`MarkItDown init failed: ${initRes.status}`);
  }

  const initData = await initRes.json();
  if (initData.error) {
    throw new Error(`MarkItDown init error: ${initData.error.message}`);
  }

  // 发送 initialized 通知
  await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    })
  });

  sessionInitialized = true;
}

export function createMarkItDownClient(mcpUrl: string) {
  return {
    async convertUrl(url: string): Promise<string | null> {
      try {
        await ensureInitialized(mcpUrl);

        const res = await fetch(mcpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "convert_to_markdown",
              arguments: { uri: url }
            }
          })
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (data.error) return null;

        const content = data.result?.content;
        if (!content || content.length === 0) return null;

        return content[0].text ?? null;
      } catch {
        return null; // 优雅降级：MarkItDown 不可达
      }
    }
  };
}
