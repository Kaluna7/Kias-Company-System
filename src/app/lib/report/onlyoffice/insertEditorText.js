/**
 * Insert AI text into OnlyOffice editor.
 * Tries Automation API connector (Developer edition), then clipboard fallback.
 */
export async function insertTextIntoOnlyOfficeEditor(docEditor, text) {
  const content = String(text || "").trim();
  if (!content) {
    return { ok: false, method: "empty", error: "No text" };
  }

  if (docEditor && typeof docEditor.createConnector === "function") {
    try {
      const connector = docEditor.createConnector();
      if (typeof window !== "undefined") {
        window.Asc = window.Asc || {};
        window.Asc.scope = { ...(window.Asc.scope || {}), aiText: content };
      }
      await new Promise((resolve, reject) => {
        connector.callCommand(
          function () {
            var doc = Api.GetDocument();
            var p = Api.CreateParagraph();
            var text = (Asc.scope && Asc.scope.aiText) || "";
            p.AddText(text);
            doc.InsertContent([p]);
            return "ok";
          },
          false,
          true,
          function (result) {
            if (result === "ok" || result == null) resolve();
            else reject(new Error(String(result)));
          },
        );
      });
      return { ok: true, method: "connector" };
    } catch (err) {
      console.warn("[OnlyOffice AI insert] connector failed:", err);
    }
  }

  try {
    await navigator.clipboard.writeText(content);
    return {
      ok: true,
      method: "clipboard",
      message: "Teks disalin. Klik di dokumen lalu Ctrl+V untuk menempel.",
    };
  } catch {
    return {
      ok: false,
      method: "clipboard",
      error: "Tidak bisa menyalin ke clipboard. Gunakan tombol Sisipkan ke dokumen.",
    };
  }
}
