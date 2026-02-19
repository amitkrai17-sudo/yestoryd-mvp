// file: lib/rai/sse-client.ts
// Shared SSE stream reader for rAI chat clients (ChatWidget, AI Assistant page)

export interface SSECallbacks {
  onStatus: (message: string) => void;
  onChunk: (text: string) => void;
  onResponse: (content: string, meta?: { intent?: string; source?: string; needsChildSelection?: boolean }) => void;
  onChildren: (children: Array<{ id: string; name: string }>) => void;
  onDone: (meta?: { source?: string; debug?: Record<string, unknown> }) => void;
  onError: (message: string) => void;
}

/**
 * Read an SSE stream from /api/chat and dispatch events to callbacks.
 * Returns the full assembled text for streaming responses.
 */
export async function readChatSSE(
  response: Response,
  callbacks: SSECallbacks
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return '';
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case 'status':
              callbacks.onStatus(data.message);
              break;

            case 'intent':
              // Intent info — can be used for UI indicators
              break;

            case 'chunk':
              fullText += data.content;
              callbacks.onChunk(data.content);
              break;

            case 'response':
              // Instant (non-streaming) response
              fullText = data.content;
              callbacks.onResponse(data.content, {
                intent: data.intent,
                source: data.source,
                needsChildSelection: data.needsChildSelection,
              });
              break;

            case 'children':
              callbacks.onChildren(data.children);
              break;

            case 'done':
              callbacks.onDone({ source: data.source, debug: data.debug });
              break;

            case 'error':
              callbacks.onError(data.message);
              break;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  } catch (err) {
    callbacks.onError('Connection lost. Please try again.');
  }

  return fullText;
}
