import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useNotesApp } from "./hooks/useNotesApp";
import { notePreview } from "./domain/noteUtils";

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

function parseTagsInput(value) {
  return String(value || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// PUBLIC_INTERFACE
function App() {
  const { state, actions } = useNotesApp();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("");

  // Keep a local draft to avoid patchy partial updates on every keystroke.
  useEffect(() => {
    if (!state.selectedNote) {
      setDraftTitle("");
      setDraftContent("");
      setDraftTags("");
      return;
    }
    setDraftTitle(state.selectedNote.title || "");
    setDraftContent(state.selectedNote.content || "");
    setDraftTags((state.selectedNote.tags || []).join(", "));
  }, [state.selectedNoteId, state.selectedNote]);

  const canSave = useMemo(() => {
    if (!state.selectedNote) return false;
    const nextTags = parseTagsInput(draftTags);
    const tagsChanged = JSON.stringify(nextTags) !== JSON.stringify(state.selectedNote.tags || []);
    return (
      (draftTitle || "") !== (state.selectedNote.title || "") ||
      (draftContent || "") !== (state.selectedNote.content || "") ||
      tagsChanged
    );
  }, [draftTitle, draftContent, draftTags, state.selectedNote]);

  const onSave = async () => {
    if (!state.selectedNote) return;
    await actions.saveNote(state.selectedNote.id, {
      title: draftTitle,
      content: draftContent,
      tags: parseTagsInput(draftTags),
    });
  };

  const onDelete = async () => {
    if (!state.selectedNote) return;
    const ok = window.confirm(`Delete "${state.selectedNote.title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;
    await actions.deleteNote(state.selectedNote.id);
  };

  return (
    <div className="App">
      <div className="shell">
        <aside className="sidebar" aria-label="Notes sidebar">
          <div className="sidebarHeader">
            <div className="brandRow">
              <div className="brand">
                <div className="brandTitle">Notes</div>
                <div className="brandSubtitle">Lightweight note keeper</div>
              </div>
              <button className="iconBtn" onClick={actions.reload} aria-label="Reload notes" title="Reload">
                ↻
              </button>
            </div>

            <div className="btnRow">
              <button className="primaryBtn" onClick={actions.createNote} disabled={state.isSaving || state.isLoading}>
                + New note
              </button>
              <button
                className="iconBtn"
                onClick={() => actions.setSelectedTag(null)}
                aria-label="Clear tag filter"
                title="Clear tag filter"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="sidebarBody">
            {state.error && (
              <div className="alert" role="alert" aria-live="polite">
                {state.error}
              </div>
            )}

            <div className="sectionTitleRow" style={{ marginTop: 14 }}>
              <div className="sectionTitle">Tags</div>
              <span className="pill">{state.tags.length}</span>
            </div>

            {state.tags.length === 0 ? (
              <div className="mutedText">No tags yet.</div>
            ) : (
              <div className="tagRow" aria-label="Tag filters">
                <button
                  className={`tagButton ${state.selectedTag ? "" : "tagButtonActive"}`}
                  onClick={() => actions.setSelectedTag(null)}
                >
                  All
                </button>
                {state.tags.map((t) => (
                  <button
                    key={t}
                    className={`tagButton ${state.selectedTag === t ? "tagButtonActive" : ""}`}
                    onClick={() => actions.setSelectedTag(state.selectedTag === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="sectionTitleRow" style={{ marginTop: 16 }}>
              <div className="sectionTitle">Notes</div>
              <span className="pill">{state.filteredNotes.length}</span>
            </div>

            {state.isLoading ? (
              <div className="mutedText">Loading…</div>
            ) : state.filteredNotes.length === 0 ? (
              <div className="mutedText">No notes match your filters.</div>
            ) : (
              <div className="noteList" role="list" aria-label="Notes list">
                {state.filteredNotes.map((n) => {
                  const active = state.selectedNoteId !== null && String(n.id) === String(state.selectedNoteId);
                  const metaDate = formatDate(n.updatedAt || n.updated_at || n.modifiedAt || n.modified_at || n.createdAt || n.created_at);

                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`noteItem ${active ? "noteItemActive" : ""}`}
                      onClick={() => actions.setSelectedNoteId(n.id)}
                      role="listitem"
                      aria-current={active ? "true" : "false"}
                    >
                      <div className="noteItemTitle">{n.title || "Untitled"}</div>
                      <div className="noteItemPreview">{notePreview(n)}</div>
                      <div className="noteItemMeta">
                        <span>{metaDate || "—"}</span>
                        <span>{(n.tags || []).length ? `${(n.tags || []).length} tag(s)` : "No tags"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="main" aria-label="Notes main area">
          <div className="topbar">
            <div className="searchWrap">
              <input
                className="searchInput"
                value={state.query}
                onChange={(e) => actions.setQuery(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes"
              />
              {state.selectedTag ? <span className="pill">Tag: {state.selectedTag}</span> : null}
            </div>

            <div className="topbarActions">
              <button className="primaryBtn" onClick={onSave} disabled={!canSave || state.isSaving || state.isLoading}>
                {state.isSaving ? "Saving…" : "Save"}
              </button>
              <button className="dangerBtn" onClick={onDelete} disabled={!state.selectedNote || state.isDeleting}>
                {state.isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>

          <div className="content">
            {state.isLoading ? (
              <div className="card">
                <div className="mutedText">Loading note editor…</div>
              </div>
            ) : !state.selectedNote ? (
              <div className="card emptyState">
                <h2 className="emptyTitle">No note selected</h2>
                <p className="emptyHint">
                  Create a new note from the sidebar, or adjust your search/tag filters to find existing notes.
                </p>
                <div style={{ marginTop: 14 }}>
                  <button className="primaryBtn" onClick={actions.createNote} disabled={state.isSaving}>
                    + New note
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" aria-label="Note editor">
                <div className="editorHeader">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="label">Title</div>
                    <input
                      className="titleInput"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Untitled"
                      aria-label="Note title"
                    />
                  </div>
                </div>

                <div className="label">Content</div>
                <textarea
                  className="textarea"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write your note…"
                  aria-label="Note content"
                />

                <div className="formRow">
                  <div>
                    <div className="label">Tags (comma-separated)</div>
                    <input
                      className="tagsInput"
                      value={draftTags}
                      onChange={(e) => setDraftTags(e.target.value)}
                      placeholder="e.g. work, ideas, todo"
                      aria-label="Note tags"
                    />
                  </div>

                  <div className="mutedText">
                    Tip: Use tags to organize notes. Click tags in the sidebar to filter.
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
