export function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(c => {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return '[Image]';
      if (c.type === 'tool_use') {
        return `[Tool: ${c.name} (id: ${c.id})]`;
      }
      if (c.type === 'tool_result') {
        return `[Tool result: ${c.content}]`;
      }
      return '';
    }).join('\n');
  }
  return '';
}

export function detectLanguage(body) {
  const allText = body.messages?.map(m => extractText(m.content)).join('\n') || '';
  const patterns = {
    python: /\b(def |import |from |print\()/,
    javascript: /\b(const |let |function |=>|console\.)/,
    typescript: /\binterface |type |: string|: number/,
    rust: /\bfn |let mut |impl |: Result</,
    go: /\bfunc |:= |\npackage main/,
    java: /\bpublic class |System\.out\.|private static/,
    cpp: /#include|std::|using namespace/
  };
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(allText)) return lang;
  }
  return 'text';
}
