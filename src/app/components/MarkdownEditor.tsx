'use client';

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export interface MarkdownEditorHandle {
  view: EditorView | undefined;
  applyTextChange: (newText: string) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

// Custom vibrant syntax highlighting styles (matching the previous style sheet)
const vibrantHighlightStyle = HighlightStyle.define([
  // Headers (using the exact colors and background pills from the old styling)
  { 
    tag: tags.heading1, 
    color: '#b91c1c', 
    backgroundColor: '#fee2e2', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  { 
    tag: tags.heading2, 
    color: '#0369a1', 
    backgroundColor: '#e0f2fe', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  { 
    tag: tags.heading3, 
    color: '#15803d', 
    backgroundColor: '#dcfce7', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  { 
    tag: tags.heading4, 
    color: '#15803d', 
    backgroundColor: '#dcfce7', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  { 
    tag: tags.heading5, 
    color: '#15803d', 
    backgroundColor: '#dcfce7', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  { 
    tag: tags.heading6, 
    color: '#15803d', 
    backgroundColor: '#dcfce7', 
    fontWeight: 'bold', 
    padding: '0 4px', 
    borderRadius: '4px' 
  },
  
  // Inline styling (dark slate bold)
  { tag: tags.strong, color: '#0f172a', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  
  // Lists and quote markers (orange-600)
  { tag: tags.list, color: '#ea580c', fontWeight: 'bold' },
  
  // Links and URLs (blue-600 and slate-500)
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#64748b', fontStyle: 'italic' },
  
  // YAML Frontmatter (divider in terracotta, key in indigo, val in teal)
  { tag: tags.meta, color: '#c2410c', fontWeight: 'bold' },
  { tag: tags.processingInstruction, color: '#c2410c' },
  { tag: tags.keyword, color: '#4f46e5', fontWeight: 'bold' },
  { tag: tags.propertyName, color: '#4f46e5', fontWeight: 'bold' },
  { tag: tags.string, color: '#0d9488' },
  { tag: tags.comment, color: '#94a3b8' }
]);

// Theme customizations for the editor container and layout
const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14.5px",
    backgroundColor: '#faf8f5',
    minHeight: '60vh',
    color: '#2d2a26 !important'
  },
  ".cm-content": {
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.6',
    padding: '24px',
    color: '#2d2a26 !important'
  },
  ".cm-line": {
    color: '#2d2a26 !important'
  },
  ".cm-scroller": {
    overflow: "auto",
    minHeight: '60vh',
  },
  "&.cm-focused": {
    outline: "none"
  },
  ".cm-cursor": {
    borderLeftColor: '#c66a4e', // terracotta cursor
    borderLeftWidth: '2px'
  },
  // Selection styling
  ".cm-selectionBackground, ::selection": {
    backgroundColor: '#fbece8 !important',
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: '#fbece8 !important',
  }
});

const MarkdownEditor = React.forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, onChange, disabled }, ref) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    useImperativeHandle(ref, () => ({
      get view() {
        return editorRef.current?.view;
      },
      applyTextChange(newText: string) {
        const view = editorRef.current?.view;
        if (view) {
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: newText
            }
          });
        }
      }
    }));

    return (
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        readOnly={disabled}
        extensions={[
          markdown(),
          syntaxHighlighting(vibrantHighlightStyle),
          editorTheme,
          EditorView.lineWrapping
        ]}

        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          dropCursor: true
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;
