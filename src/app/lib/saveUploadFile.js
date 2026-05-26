import { createWriteStream } from "fs";
import { writeFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

/**
 * Save an uploaded Blob/File to disk. Streams when possible to avoid loading multi-GB files into RAM.
 */
export async function saveUploadFile(file, filePath) {
  if (file && typeof file.stream === "function") {
    try {
      const webStream = file.stream();
      const nodeStream = Readable.fromWeb(webStream);
      await pipeline(nodeStream, createWriteStream(filePath));
      return;
    } catch (streamErr) {
      console.warn("saveUploadFile: stream write failed, falling back to buffer:", streamErr?.message);
    }
  }

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));
}
