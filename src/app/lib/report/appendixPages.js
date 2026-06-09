const APPENDIX_FIRST_PAGE_CAPACITY = 24;
const APPENDIX_PAGE_CAPACITY = 30;
const APPENDIX_TEXT_CHARS_PER_UNIT = 210;
const APPENDIX_TABLE_ROWS_PER_PAGE = 16;

function estimateAppendixTextUnits(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return Math.max(1, Math.ceil(normalized.length / APPENDIX_TEXT_CHARS_PER_UNIT));
}

function splitAppendixTextIntoChunks(content, maxUnitsPerChunk = 12) {
  const paragraphs = String(content || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [""];

  const chunks = [];
  let current = [];
  let usedUnits = 0;

  const pushCurrent = () => {
    if (current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      usedUnits = 0;
    }
  };

  const splitOversizedParagraph = (paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let part = "";
    const parts = [];

    words.forEach((word) => {
      const next = part ? `${part} ${word}` : word;
      if (estimateAppendixTextUnits(next) > maxUnitsPerChunk && part) {
        parts.push(part);
        part = word;
      } else {
        part = next;
      }
    });

    if (part) parts.push(part);
    return parts;
  };

  paragraphs.forEach((paragraph) => {
    const paraUnits = estimateAppendixTextUnits(paragraph);

    if (paraUnits > maxUnitsPerChunk) {
      pushCurrent();
      splitOversizedParagraph(paragraph).forEach((part) => {
        chunks.push(part);
      });
      return;
    }

    if (usedUnits + paraUnits > maxUnitsPerChunk && current.length > 0) {
      pushCurrent();
    }

    current.push(paragraph);
    usedUnits += paraUnits;
  });

  pushCurrent();
  return chunks.length > 0 ? chunks : [""];
}

/** Build paginated appendix pages for HTML preview / DOCX export. */
export function buildAppendixPages(appendices = []) {
  const pages = [];

  const pushPage = (page) => {
    if (page.segments.length > 0 || page.showAppendicesHeading) {
      pages.push(page);
    }
  };

  let currentPage = {
    showAppendicesHeading: true,
    usedCapacity: 0,
    segments: [],
  };

  const ensureCapacity = (required) => {
    const maxCapacity = currentPage.showAppendicesHeading
      ? APPENDIX_FIRST_PAGE_CAPACITY
      : APPENDIX_PAGE_CAPACITY;

    if (currentPage.segments.length > 0 && currentPage.usedCapacity + required > maxCapacity) {
      pushPage(currentPage);
      currentPage = {
        showAppendicesHeading: false,
        usedCapacity: 0,
        segments: [],
      };
    }
  };

  (appendices || []).forEach((appendix, appendixIndex) => {
    if (appendix?.type === "table") {
      const rows = Array.isArray(appendix.tableRows) ? appendix.tableRows : [];
      const rowChunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += APPENDIX_TABLE_ROWS_PER_PAGE) {
        rowChunks.push(rows.slice(i, i + APPENDIX_TABLE_ROWS_PER_PAGE));
      }
      if (rowChunks.length === 0) rowChunks.push([]);

      rowChunks.forEach((rowsChunk, chunkIndex) => {
        const requiredUnits = 10 + Math.max(1, Math.ceil(rowsChunk.length / 2));
        ensureCapacity(requiredUnits);
        currentPage.segments.push({
          type: "table",
          appendixId: appendix.id,
          appendixIndex,
          title: appendix.title,
          subtitle: appendix.content || "Risk Matrix",
          rows: rowsChunk,
          isContinued: chunkIndex > 0,
        });
        currentPage.usedCapacity += requiredUnits;
      });
      return;
    }

    const textChunks = splitAppendixTextIntoChunks(appendix?.content || "", 10);
    textChunks.forEach((textChunk, chunkIndex) => {
      const requiredUnits = 4 + estimateAppendixTextUnits(textChunk || " ");
      ensureCapacity(requiredUnits);
      currentPage.segments.push({
        type: "text",
        appendixId: appendix.id,
        appendixIndex,
        title: appendix.title,
        content: textChunk,
        isContinued: chunkIndex > 0,
      });
      currentPage.usedCapacity += requiredUnits;
    });
  });

  pushPage(currentPage);
  return pages;
}

function normalizeAppendixPages(pages) {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((page) => ({
      showAppendicesHeading: page?.showAppendicesHeading === true,
      segments: Array.isArray(page?.segments) ? page.segments : [],
    }))
    .filter((page) => page.segments.length > 0 || page.showAppendicesHeading);
}

/**
 * Resolve appendix pages for DOCX from export payload or DB appendices array.
 * @param {object} payload
 */
export function resolveAppendixPagesFromPayload(payload = {}) {
  const saved = normalizeAppendixPages(payload.appendixPages);
  if (saved.length > 0) return saved;

  const appendices = Array.isArray(payload.appendices) ? payload.appendices : [];
  if (appendices.length === 0) return [];

  return buildAppendixPages(appendices);
}
