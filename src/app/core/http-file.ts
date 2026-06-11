/** Parser for VS Code REST-Client style `.http`/`.rest` files. Pure — no
 *  Tauri/Angular imports — so it stays unit-testable. Lenient by design:
 *  a section that doesn't look like a request renders as a raw block. */

export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpFileVariable {
  name: string;
  value: string;
}

export interface HttpRequestBlock {
  kind: 'request';
  name: string | null;
  method: string;
  url: string;
  httpVersion: string | null;
  headers: HttpHeader[];
  body: string;
}

export interface HttpRawBlock {
  kind: 'raw';
  text: string;
}

export type HttpBlock = HttpRequestBlock | HttpRawBlock;

export interface HttpFile {
  variables: HttpFileVariable[];
  blocks: HttpBlock[];
}

const METHOD_RE =
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(\S+)(?:\s+(HTTP\/\S+))?\s*$/i;
const VARIABLE_RE = /^@([\w.-]+)\s*=\s*(.*)$/;
const HEADER_RE = /^([\w-]+):\s*(.*)$/;

export function parseHttpFile(source: string): HttpFile {
  const variables: HttpFileVariable[] = [];
  const blocks: HttpBlock[] = [];

  // Sections are separated by lines starting with `###`; text after the
  // separator names the following request.
  const sections: { name: string | null; lines: string[] }[] = [];
  let current: { name: string | null; lines: string[] } = { name: null, lines: [] };
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('###')) {
      sections.push(current);
      current = { name: line.replace(/^#+\s*/, '').trim() || null, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  for (const section of sections) {
    const block = parseSection(section.name, section.lines, variables);
    if (block) blocks.push(block);
  }
  return { variables, blocks };
}

function parseSection(
  name: string | null,
  lines: string[],
  variables: HttpFileVariable[],
): HttpBlock | null {
  let i = 0;
  // Leading blank lines, comments, and file variables before the request line.
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('//') || line.startsWith('#')) {
      i++;
      continue;
    }
    const variable = VARIABLE_RE.exec(line);
    if (variable) {
      variables.push({ name: variable[1], value: variable[2].trim() });
      i++;
      continue;
    }
    break;
  }
  if (i >= lines.length) return null; // nothing but noise — drop the section

  const requestLine = lines[i].trim();
  const m = METHOD_RE.exec(requestLine);
  let method: string;
  let url: string;
  let httpVersion: string | null = null;
  if (m) {
    method = m[1].toUpperCase();
    url = m[2];
    httpVersion = m[3] ?? null;
    i++;
  } else if (
    /^[a-z+]+:\/\/\S+$/i.test(requestLine) ||
    requestLine.startsWith('/') ||
    requestLine.startsWith('{{')
  ) {
    // Bare URL = implicit GET (REST-Client convention).
    method = 'GET';
    url = requestLine;
    i++;
  } else {
    return { kind: 'raw', text: lines.join('\n').trim() };
  }

  const headers: HttpHeader[] = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      i++;
      break;
    }
    const h = HEADER_RE.exec(line);
    if (!h) break; // tolerate oddities — everything from here counts as body
    headers.push({ name: h[1], value: h[2] });
    i++;
  }
  const body = lines.slice(i).join('\n').trim();
  return { kind: 'request', name, method, url, httpVersion, headers, body };
}
