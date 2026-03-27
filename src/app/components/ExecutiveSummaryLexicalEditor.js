"use client";

import { useEffect } from "react";
import {
  LexicalComposer,
  RichTextPlugin,
  ContentEditable,
  HistoryPlugin,
} from "@lexical/react/LexicalComposer";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { $getRoot, $getSelection } from "lexical";

const theme = {
  paragraph: "mb-2",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
  },
  list: {
    ul: "list-disc ml-6 mb-2",
    ol: "list-decimal ml-6 mb-2",
  },
};

function OnChangePlugin({ onChange }) {
  useEffect(() => {
    return window.editor?.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const selection = $getSelection();
        // eslint-disable-next-line no-unused-vars
        const json = editorState.toJSON();
        const html = root.__cachedText ?? root.getTextContent();
        if (onChange) onChange(html);
      });
    });
  }, [onChange]);
  return null;
}

export default function ExecutiveSummaryLexicalEditor({ initialHtml, onChange }) {
  const initialConfig = {
    namespace: "ExecutiveSummaryEditor",
    theme,
    onError(error) {
      // eslint-disable-next-line no-console
      console.error(error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="border border-gray-200 rounded-md">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[220px] max-h-[360px] overflow-auto p-3 text-[11px] leading-relaxed outline-none" />
          }
          placeholder={null}
        />
        <HistoryPlugin />
        <ListPlugin />
        <AutoFocusPlugin />
        <OnChangePlugin onChange={onChange} />
      </div>
    </LexicalComposer>
  );
}

