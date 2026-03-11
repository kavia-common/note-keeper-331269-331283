import { apiRequest } from "./client";

/**
 * NOTE: Backend OpenAPI currently exposes only a health endpoint in the hosted /docs UI.
 * Information about actual notes endpoints is not available from current sources.
 *
 * To keep the frontend reusable and debuggable, we centralize endpoint paths here.
 * If backend paths differ, update ONLY this module (single canonical code path).
 */

const DEFAULT_ENDPOINTS = {
  listNotes: "/notes",
  getNote: (id) => `/notes/${encodeURIComponent(id)}`,
  createNote: "/notes",
  updateNote: (id) => `/notes/${encodeURIComponent(id)}`,
  deleteNote: (id) => `/notes/${encodeURIComponent(id)}`,

  listTags: "/tags",
  // Search is implemented as listNotes with ?q= by default. If backend has /search, change here.
  searchNotes: "/notes",
};

/**
 * @typedef {Object} Note
 * @property {string|number} id
 * @property {string} title
 * @property {string} content
 * @property {string[]|undefined} tags
 * @property {string|undefined} updatedAt
 * @property {string|undefined} createdAt
 */

/**
 * @typedef {Object} NotesApi
 * @property {(params?: {q?: string, tag?: string, signal?: AbortSignal}) => Promise<any>} listNotes
 * @property {(id: string|number, params?: {signal?: AbortSignal}) => Promise<any>} getNote
 * @property {(payload: {title?: string, content?: string, tags?: string[]}, params?: {signal?: AbortSignal}) => Promise<any>} createNote
 * @property {(id: string|number, payload: {title?: string, content?: string, tags?: string[]}, params?: {signal?: AbortSignal}) => Promise<any>} updateNote
 * @property {(id: string|number, params?: {signal?: AbortSignal}) => Promise<any>} deleteNote
 * @property {(params?: {signal?: AbortSignal}) => Promise<any>} listTags
 */

/**
 * PUBLIC_INTERFACE
 * Create a NotesApi instance.
 *
 * Contract:
 * - Centralizes all backend calls; callers must not call fetch directly.
 * - Returns `apiRequest` results ({ok, data/status} or {ok:false, error}).
 */
export function createNotesApi(endpoints = DEFAULT_ENDPOINTS) {
  /** @type {NotesApi} */
  const api = {
    async listNotes(params = {}) {
      const { q, tag, signal } = params;
      return apiRequest("notes.list", endpoints.listNotes, {
        method: "GET",
        query: { q, tag },
        signal,
      });
    },

    async getNote(id, params = {}) {
      const { signal } = params;
      return apiRequest("notes.get", endpoints.getNote(id), { method: "GET", signal });
    },

    async createNote(payload, params = {}) {
      const { signal } = params;
      return apiRequest("notes.create", endpoints.createNote, { method: "POST", body: payload, signal });
    },

    async updateNote(id, payload, params = {}) {
      const { signal } = params;
      return apiRequest("notes.update", endpoints.updateNote(id), { method: "PUT", body: payload, signal });
    },

    async deleteNote(id, params = {}) {
      const { signal } = params;
      return apiRequest("notes.delete", endpoints.deleteNote(id), { method: "DELETE", signal });
    },

    async listTags(params = {}) {
      const { signal } = params;
      return apiRequest("tags.list", endpoints.listTags, { method: "GET", signal });
    },
  };

  return api;
}

export const notesApi = createNotesApi();
