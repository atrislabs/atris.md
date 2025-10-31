const https = require('https');
const http = require('http');
const { getApiBaseUrl } = require('./api');

/**
 * Execute code via Claude Agent SDK backend endpoint.
 * 
 * @param {Object} options
 * @param {string} options.prompt - Code execution prompt
 * @param {string[]} options.allowedTools - Allowed tools (e.g., ['Read', 'Write', 'Bash', 'Edit'])
 * @param {string} options.permissionMode - Permission mode: 'default', 'acceptEdits', 'plan', 'bypassPermissions'
 * @param {number} options.maxTurns - Maximum agentic turns
 * @param {string} [options.systemPrompt] - Custom system prompt
 * @param {string} [options.workingDirectory] - Working directory for code execution
 * @param {string} [options.conversationId] - Session/conversation ID for multi-turn
 * @param {string} options.agentId - Agent ID
 * @param {string} options.token - Auth token
 * @param {Function} [options.onMessage] - Callback for each SSE message
 * @param {Function} [options.onError] - Callback for errors
 * @returns {Promise<void>}
 */
async function executeCodeExecution({
  prompt,
  allowedTools = ['Read', 'Write', 'Bash', 'Edit'],
  permissionMode = 'default',
  maxTurns = 5,
  systemPrompt,
  workingDirectory,
  conversationId,
  agentId,
  token,
  onMessage,
  onError,
}) {
  return new Promise((resolve, reject) => {
    // getApiBaseUrl returns 'https://api.atris.ai/api'
    // We need 'https://api.atris.ai' for the base URL
    const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '');
    const path = `/api/agent/${agentId}/code/exec`;
    const url = `${baseUrl}${path}`;
    
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const payload = JSON.stringify({
      prompt,
      allowed_tools: allowedTools,
      permission_mode: permissionMode,
      max_turns: maxTurns,
      conversation_id: conversationId,
      stream: true,
      ...(systemPrompt && { system_prompt: systemPrompt }),
      ...(workingDirectory && { working_directory: workingDirectory }),
    });

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Agent-ID': agentId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = transport.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', (chunk) => {
          errorData += chunk.toString();
        });
        res.on('end', () => {
          const error = new Error(`API request failed: ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.body = errorData;
          if (onError) {
            onError(error);
          }
          reject(error);
        });
        return;
      }

      let buffer = '';
      let hasError = false;
      let completed = false;

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'error') {
                hasError = true;
                const error = new Error(data.error || 'Unknown error');
                if (onError) {
                  onError(error, data);
                }
              } else if (onMessage) {
                onMessage(data);
              }

              // Check for completion
              if (data.type === 'complete') {
                completed = true;
                if (!hasError) {
                  resolve();
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      res.on('end', () => {
        // Process remaining buffer
        if (buffer) {
          if (buffer.startsWith('data: ')) {
            try {
              const data = JSON.parse(buffer.substring(6));
              if (onMessage) {
                onMessage(data);
              }
              if (data.type === 'complete') {
                completed = true;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
        
        // Resolve if we haven't already (in case complete event wasn't received)
        if (!completed) {
          if (hasError) {
            reject(new Error('Stream ended with errors'));
          } else {
            resolve();
          }
        } else if (hasError) {
          reject(new Error('Execution completed with errors'));
        }
      });
    });

    req.on('error', (e) => {
      if (onError) {
        onError(e);
      }
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  executeCodeExecution,
};

