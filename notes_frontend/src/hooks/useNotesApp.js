import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notesApi } from "../api/notesApi";
import { extractTags, filterNotes } from "../domain/noteUtils";

/**
 * @typedef {Object} NotesAppState
 * @property {boolean} isLoading
 * @property {string|null} error
 * @property {Array<any>} notes
 * @property {Array<string>} tags
 * @property {string|null} selectedNoteId
 * @property {string} query
 * @property {string|null} selectedTag
 * @property {boolean} isSaving
 * @property {boolean} isDeleting
 */

/**
 * PUBLIC_INTERFACE
 * Main Notes App flow hook.
 *
 * Contract:
 * Inputs:
 * - none (currently), configuration is centralized in notesApi
 *
 * Outputs:
 * - state + actions for CRUD/search/tag filters
 *
 * Errors:
 * - returns user-friendly `error` string; detailed info remains in console logs
 *
 * Side effects:
 * - network calls to backend on initial load and CRUD
 */
export function useNotesApp() {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);

  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState(null);

  const initialLoadAbort = useRef(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    initialLoadAbort.current = controller;

    console.info("[NotesAppFlow] loadAll:start");

    const [notesRes, tagsRes] = await Promise.all([
      notesApi.listNotes({ signal: controller.signal }),
      notesApi.listTags({ signal: controller.signal }),
    ]);

    if (!notesRes.ok) {
      console.error("[NotesAppFlow] loadAll:notes:error", notesRes.error);
      setError(`Failed to load notes. ${notesRes.error.message}`);
      setIsLoading(false);
      return;
    }

    const nextNotes = Array.isArray(notesRes.data) ? notesRes.data : notesRes.data?.notes || [];
    setNotes(nextNotes);

    if (tagsRes.ok) {
      const nextTags = Array.isArray(tagsRes.data) ? tagsRes.data : tagsRes.data?.tags || [];
      setTags(nextTags);
    } else {
      // Backend may not implement tags endpoint yet; gracefully derive from notes.
      console.warn("[NotesAppFlow] loadAll:tags:warn", tagsRes.error);
      setTags(extractTags(nextNotes));
    }

    // Auto-select first note if none selected.
    setSelectedNoteId((prev) => prev ?? (nextNotes[0]?.id ?? null));

    setIsLoading(false);
    console.info("[NotesAppFlow] loadAll:success", { notes: nextNotes.length });
  }, []);

  useEffect(() => {
    loadAll();
    return () => {
      if (initialLoadAbort.current) initialLoadAbort.current.abort();
    };
  }, [loadAll]);

  const derivedTags = useMemo(() => {
    const derived = extractTags(notes);
    // Use backend tags if they exist, else derived.
    return tags?.length ? Array.from(new Set([...tags, ...derived])).sort((a, b) => a.localeCompare(b)) : derived;
  }, [notes, tags]);

  const filteredNotes = useMemo(() => {
    return filterNotes(notes, { q: query, tag: selectedTag });
  }, [notes, query, selectedTag]);

  const selectedNote = useMemo(() => {
    return notes.find((n) => String(n.id) === String(selectedNoteId)) || null;
  }, [notes, selectedNoteId]);

  const createNote = useCallback(async () => {
    setError(null);
    setIsSaving(true);

    console.info("[NotesAppFlow] createNote:start");

    const res = await notesApi.createNote({
      title: "Untitled",
      content: "",
      tags: [],
    });

    if (!res.ok) {
      console.error("[NotesAppFlow] createNote:error", res.error);
      setError(`Failed to create note. ${res.error.message}`);
      setIsSaving(false);
      return;
    }

    const created = res.data?.note || res.data;
    if (!created || created.id === undefined || created.id === null) {
      console.warn("[NotesAppFlow] createNote:unexpected-response", res.data);
    }

    setNotes((prev) => [created, ...prev].filter(Boolean));
    setSelectedNoteId(created?.id ?? null);

    setIsSaving(false);
    console.info("[NotesAppFlow] createNote:success", { id: created?.id });
  }, []);

  const saveNote = useCallback(async (id, patch) => {
    setError(null);
    setIsSaving(true);

    console.info("[NotesAppFlow] saveNote:start", { id });

    const res = await notesApi.updateNote(id, patch);

    if (!res.ok) {
      console.error("[NotesAppFlow] saveNote:error", res.error);
      setError(`Failed to save note. ${res.error.message}`);
      setIsSaving(false);
      return;
    }

    const updated = res.data?.note || res.data;

    setNotes((prev) => prev.map((n) => (String(n.id) === String(id) ? { ...n, ...updated } : n)));
    setIsSaving(false);
    console.info("[NotesAppFlow] saveNote:success", { id });
  }, []);

  const deleteNote = useCallback(async (id) => {
    setError(null);
    setIsDeleting(true);

    console.info("[NotesAppFlow] deleteNote:start", { id });

    const res = await notesApi.deleteNote(id);
    if (!res.ok) {
      console.error("[NotesAppFlow] deleteNote:error", res.error);
      setError(`Failed to delete note. ${res.error.message}`);
      setIsDeleting(false);
      return;
    }

    setNotes((prev) => prev.filter((n) => String(n.id) !== String(id)));

    setSelectedNoteId((prevSelected) => {
      if (String(prevSelected) !== String(id)) return prevSelected;
      const remaining = notes.filter((n) => String(n.id) !== String(id));
      return remaining[0]?.id ?? null;
    });

    setIsDeleting(false);
    console.info("[NotesAppFlow] deleteNote:success", { id });
  }, [notes]);

  return {
    state: {
      isLoading,
      isSaving,
      isDeleting,
      error,
      notes,
      filteredNotes,
      tags: derivedTags,
      selectedNoteId,
      selectedNote,
      query,
      selectedTag,
    },
    actions: {
      reload: loadAll,
      setSelectedNoteId,
      setQuery,
      setSelectedTag,
      createNote,
      saveNote,
      deleteNote,
    },
  };
}
