'use client';

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { StateField, StateEffect, Range } from '@codemirror/state';
import { diffWords } from 'diff';

export interface MarkdownEditorHandle {
  view: EditorView | undefined;
  applyTextChange: (newText: string) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  originalValue?: string;
  showDeletions?: boolean;
}

// Effect to set the original text
export const setOriginalTextEffect = StateEffect.define<string>();

// StateField to store the original text
export const originalTextState = StateField.define<string>({
  create() {
    return '';
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setOriginalTextEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

// Effect and StateField to control showing deletions
export const setShowDeletionsEffect = StateEffect.define<boolean>();
export const showDeletionsState = StateField.define<boolean>({
  create() {
    return true;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setShowDeletionsEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

// CodeMirror Widget to render deleted text inline
class DeletedInlineWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: DeletedInlineWidget) {
    return this.text === other.text;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-diff-deleted-inline';
    span.textContent = this.text;
    return span;
  }
}

// StateField to compute and track decorations for additions and deletions
export const diffStateField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    const originalText = tr.state.field(originalTextState);
    const showDeletions = tr.state.field(showDeletionsState);

    // Update if the document changed, the original text was updated, or deletions toggled
    if (tr.docChanged || tr.effects.some(e => e.is(setOriginalTextEffect) || e.is(setShowDeletionsEffect))) {
      if (!originalText) {
        return Decoration.none;
      }

      const currentText = tr.state.doc.toString();
      const changes = diffWords(originalText, currentText);
      const decos: Range<Decoration>[] = [];

      let currentPos = 0;
      const docLength = tr.state.doc.length;

      for (const change of changes) {
        const len = change.value.length;

        if (change.added) {
          // Mark added text inline
          if (currentPos + len <= docLength) {
            decos.push(
              Decoration.mark({
                class: 'cm-diff-added-inline'
              }).range(currentPos, currentPos + len)
            );
            currentPos += len;
          }
        } else if (change.removed) {
          // Render inline widget for deleted text ONLY if showDeletions is true
          if (showDeletions && currentPos <= docLength) {
            decos.push(
              Decoration.widget({
                widget: new DeletedInlineWidget(change.value),
                side: -1,
                block: false
              }).range(currentPos)
            );
          }
        } else {
          // Unchanged
          currentPos += len;
        }
      }

      // Sort ranges by start position (CodeMirror requirement)
      decos.sort((a, b) => a.from - b.from);
      return Decoration.set(decos);
    }

    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f)
});

// Minimal syntax highlighting styles (making headings bold, others normal)
const minimalHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold' },
  { tag: tags.heading2, fontWeight: 'bold' },
  { tag: tags.heading3, fontWeight: 'bold' },
  { tag: tags.heading4, fontWeight: 'bold' },
  { tag: tags.heading5, fontWeight: 'bold' },
  { tag: tags.heading6, fontWeight: 'bold' },
  { tag: tags.meta, fontWeight: 'normal' },
  { tag: tags.processingInstruction, fontWeight: 'normal' },
  { tag: tags.keyword, fontWeight: 'normal' },
  { tag: tags.propertyName, fontWeight: 'normal' }
]);

// Theme customizations for the editor container and layout
const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14.5px",
    backgroundColor: 'transparent',
    minHeight: '60vh',
    color: '#2d2a26 !important'
  },
  ".cm-content": {
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.6',
    padding: '12px',
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

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, onChange, disabled, originalValue, showDeletions = true }, ref) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [editorView, setEditorView] = useState<EditorView | null>(null);

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

    // Handle initial originalValue or updates dynamically
    useEffect(() => {
      const view = editorView || editorRef.current?.view;
      if (view && originalValue !== undefined) {
        view.dispatch({
          effects: setOriginalTextEffect.of(originalValue)
        });
      }
    }, [originalValue, editorView]);

    // Handle showDeletions updates dynamically
    useEffect(() => {
      const view = editorView || editorRef.current?.view;
      if (view && showDeletions !== undefined) {
        view.dispatch({
          effects: setShowDeletionsEffect.of(showDeletions)
        });
      }
    }, [showDeletions, editorView]);

    const handleCreateEditor = (view: EditorView) => {
      setEditorView(view);
    };

    return (
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        readOnly={disabled}
        onCreateEditor={handleCreateEditor}
        extensions={[
          markdown(),
          syntaxHighlighting(minimalHighlightStyle),
          editorTheme,
          EditorView.lineWrapping,
          originalTextState.init(() => originalValue || ''),
          showDeletionsState.init(() => showDeletions),
          diffStateField
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
