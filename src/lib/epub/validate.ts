import JSZip from "jszip";

// Structural EPUB checks covering what KDP's converter and epubcheck reject
// most often: container layout, manifest/spine integrity, well-formed XHTML,
// and links/images that resolve inside the package.  Runs in-process (no
// Java epubcheck dependency) on every generated file.

export interface EpubIssue {
  file: string;
  message: string;
}

const VOID_TAGS = new Set(["meta", "link", "img", "br", "hr", "col", "input"]);

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i + 1);
}

function resolvePath(base: string, href: string): string {
  const parts = (dirOf(base) + href).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

// Tag-balance check: every element closed in order (XHTML is XML).
function wellFormedError(xml: string): string | null {
  const stack: string[] = [];
  const tagRe = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  const body = xml.replace(/<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, "");
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(body)) return "unescaped '&' or unknown entity";
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body)) !== null) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      const open = stack.pop();
      if (open !== name) return `</${name}> closes <${open ?? "nothing"}>`;
    } else if (VOID_TAGS.has(name.toLowerCase())) {
      return `<${name}> must be self-closed in XHTML`;
    } else {
      stack.push(name);
    }
  }
  return stack.length ? `unclosed <${stack[stack.length - 1]}>` : null;
}

export async function validateEpub(buffer: Buffer): Promise<EpubIssue[]> {
  const issues: EpubIssue[] = [];
  const add = (file: string, message: string) => issues.push({ file, message });

  // mimetype must be the first entry, stored uncompressed, exact content.
  if (buffer.toString("ascii", 0, 4) !== "PK\x03\x04") return [{ file: "", message: "not a ZIP archive" }];
  const nameLen = buffer.readUInt16LE(26);
  if (buffer.toString("ascii", 30, 30 + nameLen) !== "mimetype") add("mimetype", "must be the first file in the archive");
  if (buffer.readUInt16LE(8) !== 0) add("mimetype", "must be stored uncompressed");

  const zip = await JSZip.loadAsync(buffer);
  const mimetype = await zip.file("mimetype")?.async("string");
  if (mimetype !== "application/epub+zip") add("mimetype", "content must be exactly application/epub+zip");

  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) return [...issues, { file: "META-INF/container.xml", message: "missing or has no rootfile" }];
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) return [...issues, { file: opfPath, message: "package document missing" }];

  for (const req of ["dc:identifier", "dc:title", "dc:language"]) {
    if (!new RegExp(`<${req}[^>]*>[^<]+</${req}>`).test(opf)) add(opfPath, `missing <${req}>`);
  }
  if (!/property="dcterms:modified">\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ</.test(opf)) add(opfPath, "missing or malformed dcterms:modified");

  const items = Array.from(opf.matchAll(/<item\s([^>]*)\/>/g), (m) => {
    const attr = (n: string) => m[1].match(new RegExp(`${n}="([^"]*)"`))?.[1] || "";
    return { id: attr("id"), href: attr("href"), mediaType: attr("media-type"), properties: attr("properties") };
  });
  const ids = new Set<string>();
  const manifestPaths = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) add(opfPath, `duplicate manifest id "${it.id}"`);
    ids.add(it.id);
    const p = resolvePath(opfPath, it.href);
    manifestPaths.add(p);
    if (!zip.file(p)) add(opfPath, `manifest item "${it.href}" is not in the archive`);
  }
  if (!items.some((it) => it.properties.split(/\s+/).includes("nav"))) add(opfPath, "no navigation document (properties=\"nav\")");

  const spine = Array.from(opf.matchAll(/<itemref\s+idref="([^"]+)"/g), (m) => m[1]);
  if (spine.length === 0) add(opfPath, "empty spine");
  for (const idref of spine) if (!ids.has(idref)) add(opfPath, `spine references unknown id "${idref}"`);

  zip.forEach((path, file) => {
    if (file.dir || path === "mimetype" || path.startsWith("META-INF/") || path === opfPath) return;
    if (!manifestPaths.has(path)) add(path, "file is not declared in the manifest");
  });

  // XHTML content: well-formed, no data: URIs, every link/image resolves.
  const xhtml = items.filter((it) => it.mediaType === "application/xhtml+xml");
  const docs = new Map<string, string>();
  for (const it of xhtml) {
    const p = resolvePath(opfPath, it.href);
    const text = await zip.file(p)?.async("string");
    if (text !== undefined) docs.set(p, text);
  }
  const idsIn = (doc: string) => new Set(Array.from(doc.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
  for (const [p, doc] of docs) {
    const err = wellFormedError(doc);
    if (err) add(p, `not well-formed: ${err}`);
    const docIds = Array.from(doc.matchAll(/\sid="([^"]+)"/g), (m) => m[1]);
    if (new Set(docIds).size !== docIds.length) add(p, "duplicate id attributes");
    for (const m of doc.matchAll(/<img\s([^>]*)\/?>/g)) {
      if (!/\salt="/.test(` ${m[1]}`)) add(p, "<img> without alt text");
    }
    for (const m of doc.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const ref = m[1];
      if (/^data:/i.test(ref)) {
        add(p, "inline data: URI (images must be separate manifest files)");
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue; // external link
      const [file, frag] = ref.split("#");
      const target = file ? resolvePath(p, file) : p;
      if (!zip.file(target)) {
        add(p, `link target "${ref}" is not in the archive`);
        continue;
      }
      if (frag && docs.has(target) && !idsIn(docs.get(target)!).has(frag)) add(p, `link fragment "#${frag}" not found in ${target}`);
    }
  }
  return issues;
}
