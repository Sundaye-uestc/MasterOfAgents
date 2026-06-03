/**
 * Client-side PPTX parser using JSZip + DOMParser.
 *
 * PPTX is a ZIP archive of OOXML files. This module unzips a .pptx
 * ArrayBuffer, extracts slide content (text, images, tables), and
 * returns structured data suitable for rendering.
 */

import JSZip from "jszip";

// OOXML namespaces
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** EMU (English Metric Units) per inch — used to convert positions to px */
const EMU_PER_INCH = 914400;
const DEFAULT_DPI = 96;

function emuToPx(emu: number, dpi = DEFAULT_DPI): number {
  return (emu / EMU_PER_INCH) * dpi;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PptxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number; // points
  color?: string;    // hex
}

export interface PptxParagraph {
  runs: PptxTextRun[];
  alignment?: string; // "left" | "center" | "right"
}

export interface PptxShape {
  type: "text" | "image" | "table" | "group" | "other";
  name?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** For text shapes */
  paragraphs?: PptxParagraph[];
  /** For image shapes */
  imageDataUrl?: string | null;
  /** For tables */
  tableRows?: string[][];
}

export interface PptxSlide {
  index: number;
  shapes: PptxShape[];
  widthPx: number;
  heightPx: number;
  layoutName?: string;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function qnA(tag: string): string {
  return `{${NS_A}}${tag}`;
}
function qnP(tag: string): string {
  return `{${NS_P}}${tag}`;
}
function qnR(tag: string): string {
  return `{${NS_R}}${tag}`;
}

/** Safe attribute value — returns "" on missing */
function attr(el: Element | null, qname: string): string {
  return el?.getAttribute(qname) ?? "";
}

/** Get text content of first child matching tag */
function childText(parent: Element | null, qname: string): string {
  const child = parent?.getElementsByTagNameNS?.call
    ? parent.getElementsByTagName(qname).item(0)
    : null;
  return child?.textContent ?? "";
}

/** Parse an EMU value from attribute (e.g. `x`, `cx`) */
function emuAttr(el: Element | null, name: string): number {
  const val = attr(el, name);
  return val ? parseInt(val, 10) : 0;
}

/** Convert hex color string (e.g. "FF0000") to CSS hex */
function hexToCss(hex: string): string {
  if (!hex || hex.length < 6) return "";
  // PPTX colors may have alpha prefix — strip it
  const clean = hex.length === 8 ? hex.slice(2) : hex;
  return `#${clean}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseRun(rEl: Element): PptxTextRun {
  const rPr = rEl.getElementsByTagNameNS(NS_A, "rPr").item(0);
  const tEl = rEl.getElementsByTagNameNS(NS_A, "t").item(0);

  const run: PptxTextRun = {
    text: tEl?.textContent ?? "",
  };

  if (rPr) {
    const b = attr(rPr, "b");
    const i = attr(rPr, "i");
    const sz = attr(rPr, "sz");
    const srgbClr = rPr.getElementsByTagNameNS(NS_A, "srgbClr").item(0);
    const schemeClr = rPr.getElementsByTagNameNS(NS_A, "schemeClr").item(0);

    if (b === "1" || b === "true") run.bold = true;
    if (i === "1" || i === "true") run.italic = true;
    if (sz) {
      // sz is in hundredths of a point (e.g. "1800" = 18pt)
      run.fontSize = parseInt(sz, 10) / 100;
    }
    if (srgbClr) {
      run.color = hexToCss(attr(srgbClr, "val"));
    } else if (schemeClr) {
      // Map common scheme colors
      const schemeVal = attr(schemeClr, "val");
      const schemeMap: Record<string, string> = {
        tx1: "#000000",
        tx2: "#44546a",
        bg1: "#ffffff",
        bg2: "#f2f2f2",
        accent1: "#4472c4",
        accent2: "#ed7d31",
        accent3: "#a5a5a5",
        accent4: "#ffc000",
        accent5: "#5b9bd5",
        accent6: "#70ad47",
        dk1: "#000000",
        dk2: "#44546a",
        lt1: "#ffffff",
        lt2: "#f2f2f2",
      };
      run.color = schemeMap[schemeVal] || "";
    }
  }

  return run;
}

function parseParagraph(pEl: Element): PptxParagraph {
  const runs: PptxTextRun[] = [];
  const rElements = Array.from(pEl.getElementsByTagNameNS(NS_A, "r"));
  for (const rEl of rElements) {
    runs.push(parseRun(rEl as Element));
  }

  let alignment: string | undefined;
  const pPr = pEl.getElementsByTagNameNS(NS_A, "pPr").item(0);
  if (pPr) {
    const algn = attr(pPr, "algn");
    if (algn) alignment = algn; // "l", "ctr", "r"
  }

  return { runs, alignment };
}

function parseTextShape(sp: Element): PptxShape {
  const xfrm = sp.getElementsByTagNameNS(NS_A, "xfrm").item(0);
  const off = xfrm?.getElementsByTagNameNS(NS_A, "off").item(0);
  const ext = xfrm?.getElementsByTagNameNS(NS_A, "ext").item(0);

  const paragraphs: PptxParagraph[] = [];
  const txBody = sp.getElementsByTagNameNS(NS_A, "txBody")?.item(0);
  if (txBody) {
    const pElements = Array.from(txBody.getElementsByTagNameNS(NS_A, "p"));
    for (const pEl of pElements) {
      const para = parseParagraph(pEl as Element);
      if (para.runs.length > 0 && para.runs.some((r) => r.text.trim())) {
        paragraphs.push(para);
      }
    }
  }

  const nvSpPr = sp.getElementsByTagNameNS(NS_P, "nvSpPr")?.item(0);
  const cNvPr = nvSpPr?.getElementsByTagNameNS(NS_P, "cNvPr")?.item(0);

  return {
    type: "text",
    name: attr(cNvPr ?? null, "name"),
    left: off ? emuToPx(emuAttr(off, "x")) : 0,
    top: off ? emuToPx(emuAttr(off, "y")) : 0,
    width: ext ? emuToPx(emuAttr(ext, "cx")) : 0,
    height: ext ? emuToPx(emuAttr(ext, "cy")) : 0,
    paragraphs,
  };
}

function parseImageShape(
  sp: Element,
  relationships: Map<string, string>,
  mediaFiles: Map<string, Blob>
): PptxShape {
  const xfrm = sp.getElementsByTagNameNS(NS_A, "xfrm").item(0);
  const off = xfrm?.getElementsByTagNameNS(NS_A, "off").item(0);
  const ext = xfrm?.getElementsByTagNameNS(NS_A, "ext").item(0);

  // Find blipFill → blip → @r:embed
  let imageDataUrl: string | null = null;
  const blipFill = sp.getElementsByTagNameNS(NS_P, "blipFill").item(0);
  if (blipFill) {
    const blip = blipFill.getElementsByTagNameNS(NS_A, "blip").item(0);
    const embed = blip?.getAttributeNS(NS_R, "embed") ?? "";
    if (embed && relationships.has(embed)) {
      const target = relationships.get(embed)!;
      // target is like "../media/image1.png" — extract filename
      const filename = target.replace(/^.*[\\/]/, "");
      const blob = mediaFiles.get(filename);
      if (blob) {
        imageDataUrl = URL.createObjectURL(blob);
      }
    }
  }

  return {
    type: "image",
    left: off ? emuToPx(emuAttr(off, "x")) : 0,
    top: off ? emuToPx(emuAttr(off, "y")) : 0,
    width: ext ? emuToPx(emuAttr(ext, "cx")) : 0,
    height: ext ? emuToPx(emuAttr(ext, "cy")) : 0,
    imageDataUrl,
  };
}

function parseTableShape(sp: Element): PptxShape {
  const xfrm = sp.getElementsByTagNameNS(NS_A, "xfrm").item(0);
  const off = xfrm?.getElementsByTagNameNS(NS_A, "off").item(0);
  const ext = xfrm?.getElementsByTagNameNS(NS_A, "ext").item(0);

  const tableRows: string[][] = [];
  const tbl = sp.getElementsByTagNameNS(NS_A, "tbl").item(0);
  if (tbl) {
    const trs = Array.from(tbl.getElementsByTagNameNS(NS_A, "tr"));
    for (const trEl of trs) {
      const row: string[] = [];
      const tcs = Array.from((trEl as Element).getElementsByTagNameNS(NS_A, "tc"));
      for (const tcEl of tcs) {
        const tElements = Array.from((tcEl as Element).getElementsByTagNameNS(NS_A, "t"));
        let cellText = "";
        for (const tEl of tElements) {
          cellText += (tEl as Element).textContent ?? "";
        }
        row.push(cellText.trim());
      }
      tableRows.push(row);
    }
  }

  return {
    type: "table",
    left: off ? emuToPx(emuAttr(off, "x")) : 0,
    top: off ? emuToPx(emuAttr(off, "y")) : 0,
    width: ext ? emuToPx(emuAttr(ext, "cx")) : 0,
    height: ext ? emuToPx(emuAttr(ext, "cy")) : 0,
    tableRows,
  };
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const rels = Array.from(doc.getElementsByTagNameNS("*", "Relationship"));
  for (const rel of rels) {
    const id = attr(rel as Element, "Id");
    const target = attr(rel as Element, "Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function parsePptx(arrayBuffer: ArrayBuffer): Promise<PptxSlide[]> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Extract all media files to a map (filename → Blob)
  const mediaFiles = new Map<string, Blob>();
  const mediaEntries = Object.keys(zip.files).filter((n) =>
    n.startsWith("ppt/media/") && !n.endsWith("/")
  );
  for (const entry of mediaEntries) {
    const file = zip.files[entry];
    if (!file) continue;
    const blob = await file.async("blob");
    const filename = entry.replace(/^.*[\\/]/, "");
    mediaFiles.set(filename, blob);
  }

  // Read presentation metadata for slide dimensions
  let slideW = 12192000; // default 10 inches
  let slideH = 6858000;  // default 7.5 inches
  const presFile = zip.files["ppt/presentation.xml"];
  if (presFile) {
    const presXml = await presFile.async("text");
    const presDoc = new DOMParser().parseFromString(presXml, "text/xml");
    const sldSz = presDoc.getElementsByTagNameNS(NS_P, "sldSz").item(0);
    if (sldSz) {
      const w = emuAttr(sldSz, "cx");
      const h = emuAttr(sldSz, "cy");
      if (w) slideW = w;
      if (h) slideH = h;
    }
  }

  // Find and sort slide files
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  const slides: PptxSlide[] = [];
  let slideIdx = 0;

  for (const slideFile of slideFiles) {
    const slideEntry = zip.files[slideFile];
    if (!slideEntry) { slideIdx++; continue; }
    const slideXml = await slideEntry.async("text");
    const slideDoc = new DOMParser().parseFromString(slideXml, "text/xml");

    // Load relationships for this slide
    const slideNum = slideFile.match(/slide(\d+)/)?.[1] ?? String(slideIdx + 1);
    const relsKey = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    let relationships = new Map<string, string>();
    const relsEntry = zip.files[relsKey];
    if (relsEntry) {
      const relsXml = await relsEntry.async("text");
      relationships = parseRelationships(relsXml);
    }

    const shapes: PptxShape[] = [];

    // Find the shape tree
    const spTree = slideDoc.getElementsByTagNameNS(NS_P, "spTree").item(0);
    if (spTree) {
      for (const child of Array.from(spTree.children)) {
        // <p:sp> — text/table shape
        if (child.namespaceURI === NS_P && child.localName === "sp") {
          // Check if it contains a table
          if (child.getElementsByTagNameNS(NS_A, "tbl").length > 0) {
            shapes.push(parseTableShape(child));
          } else {
            shapes.push(parseTextShape(child));
          }
        }
        // <p:pic> — image shape
        else if (child.namespaceURI === NS_P && child.localName === "pic") {
          shapes.push(parseImageShape(child, relationships, mediaFiles));
        }
        // <p:grpSp> — group shape (recurse into its children)
        else if (child.namespaceURI === NS_P && child.localName === "grpSp") {
          for (const subChild of Array.from(child.children)) {
            if (subChild.namespaceURI === NS_P && subChild.localName === "sp") {
              shapes.push(parseTextShape(subChild));
            } else if (subChild.namespaceURI === NS_P && subChild.localName === "pic") {
              shapes.push(parseImageShape(subChild, relationships, mediaFiles));
            }
          }
        }
      }
    }

    slides.push({
      index: slides.length,
      shapes,
      widthPx: emuToPx(slideW),
      heightPx: emuToPx(slideH),
    });
    slideIdx++;
  }

  // Cleanup: revoke any image blobs that failed to associate
  // (we keep the ones referenced from shapes — they'll be revoked on unmount)
  return slides;
}
