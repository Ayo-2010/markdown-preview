const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const editorStat = document.getElementById('editorStat');
const scrollStat = document.getElementById('scrollStat');
const statusMsg = document.getElementById('statusMsg');
const downloadBtn = document.getElementById('downloadBtn');
const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const clearBtn = document.getElementById('clearBtn');

const STORE_KEY = 'mdlive.document';

const SAMPLE = `# Welcome to MDLive

Write **markdown** on the left and watch it render instantly on the right.

## Formatting

You can make text *italic*, **bold**, ~~struck through~~ or \`inline code\`.

> Blockquotes work too — great for callouts and notes.

### Lists

- First item
- Second item
- Third item

1. Numbered lists
2. Work exactly
3. Like this

### Code

\`\`\`js
function greet(name) {
  return "Hello, " + name + "!";
}
\`\`\`

### Links and images

Visit [the GitHub docs](https://docs.github.com) for more.

---

Everything is saved to your browser automatically.`;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function renderMarkdown(source) {
  const codeBlocks = [];
  let text = source.replace(/\r\n/g, '\n');

  text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push(code);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let inQuote = false;

  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };
  const closeQuote = () => {
    if (inQuote) { html += '</blockquote>'; inQuote = false; }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (/^\u0000CODE\d+\u0000$/.test(trimmed)) {
      closeLists();
      closeQuote();
      const index = Number(trimmed.replace(/\D/g, ''));
      html += `<pre><code>${escapeHtml(codeBlocks[index])}</code></pre>`;
      return;
    }

    if (trimmed === '') {
      closeLists();
      closeQuote();
      return;
    }

    let match;

    if ((match = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      closeLists();
      closeQuote();
      const level = match[1].length;
      html += `<h${level}>${inline(match[2])}</h${level}>`;
      return;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeLists();
      closeQuote();
      html += '<hr>';
      return;
    }

    if ((match = trimmed.match(/^&gt;\s?(.*)$/))) {
      closeLists();
      if (!inQuote) { html += '<blockquote>'; inQuote = true; }
      html += `<p>${inline(match[1])}</p>`;
      return;
    }

    if ((match = trimmed.match(/^[-*+]\s+(.*)$/))) {
      closeQuote();
      if (!inUl) { closeLists(); html += '<ul>'; inUl = true; }
      html += `<li>${inline(match[1])}</li>`;
      return;
    }

    if ((match = trimmed.match(/^\d+\.\s+(.*)$/))) {
      closeQuote();
      if (!inOl) { closeLists(); html += '<ol>'; inOl = true; }
      html += `<li>${inline(match[1])}</li>`;
      return;
    }

    closeLists();
    closeQuote();
    html += `<p>${inline(trimmed)}</p>`;
  });

  closeLists();
  closeQuote();
  return html;
}

function updateStats() {
  const value = editor.value;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  editorStat.textContent = `${words} words · ${value.length} chars`;
}

function updatePreview() {
  preview.innerHTML = renderMarkdown(editor.value);
  updateStats();
}

function save() {
  localStorage.setItem(STORE_KEY, editor.value);
  statusMsg.textContent = 'Saved';
  clearTimeout(save.timer);
  save.timer = setTimeout(() => (statusMsg.textContent = 'Ready'), 1200);
}

function wrapSelection(before, after) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const selected = value.slice(start, end);

  editor.value = value.slice(0, start) + before + selected + after + value.slice(end);
  editor.focus();
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selected.length;
  updatePreview();
  save();
}

function prefixLines(prefix) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
  const block = value.slice(lineStart, lineEnd);
  const updated = block
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');

  editor.value = value.slice(0, lineStart) + updated + value.slice(lineEnd);
  editor.focus();
  editor.selectionStart = lineStart;
  editor.selectionEnd = lineStart + updated.length;
  updatePreview();
  save();
}

const SYNTAX = {
  bold: () => wrapSelection('**', '**'),
  italic: () => wrapSelection('*', '*'),
  strike: () => wrapSelection('~~', '~~'),
  code: () => wrapSelection('`', '`'),
  link: () => wrapSelection('[', '](https://example.com)'),
  image: () => wrapSelection('![alt text](', ')'),
  h1: () => prefixLines('# '),
  h2: () => prefixLines('## '),
  h3: () => prefixLines('### '),
  ul: () => prefixLines('- '),
  ol: () => prefixLines('1. '),
  quote: () => prefixLines('> '),
  hr: () => {
    const pos = editor.selectionStart;
    editor.value = editor.value.slice(0, pos) + '\n---\n' + editor.value.slice(pos);
    editor.focus();
    updatePreview();
    save();
  },
  codeblock: () => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || 'your code here';
    editor.value =
      editor.value.slice(0, start) + '```js\n' + selected + '\n```\n' + editor.value.slice(end);
    editor.focus();
    updatePreview();
    save();
  },
};

document.querySelectorAll('.tool[data-syntax]').forEach((button) => {
  button.addEventListener('click', () => SYNTAX[button.dataset.syntax]());
});

editor.addEventListener('input', () => {
  updatePreview();
  save();
});

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = start + 2;
    updatePreview();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    SYNTAX.bold();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    SYNTAX.italic();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Clear the editor?')) return;
  editor.value = '';
  updatePreview();
  save();
  editor.focus();
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([editor.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'document.md';
  link.click();
  URL.revokeObjectURL(url);
  statusMsg.textContent = 'Downloaded document.md';
});

copyHtmlBtn.addEventListener('click', () => {
  const html = renderMarkdown(editor.value);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(html).then(() => {
      statusMsg.textContent = 'HTML copied to clipboard';
      setTimeout(() => (statusMsg.textContent = 'Ready'), 1600);
    });
  }
});

editor.addEventListener('scroll', () => {
  const max = editor.scrollHeight - editor.clientHeight;
  const ratio = max > 0 ? editor.scrollTop / max : 0;
  scrollStat.textContent = `${Math.round(ratio * 100)}%`;
});

const saved = localStorage.getItem(STORE_KEY);
editor.value = saved !== null ? saved : SAMPLE;
updatePreview();
