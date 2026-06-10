import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api",
});

export const API_ORIGIN = API.defaults.baseURL.replace(/\/api\/?$/, "");

export function resolveMediaUrl(url) {
  if (!url) return "";
  if (/^(https?:)?\/\//.test(url) || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ✅ Automatically attach JWT token to every request
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// ✅ Auth
export const registerUser = (data) => API.post("/auth/register", data);
export const loginUser = (data) => API.post("/auth/login", data);
export const forgotPassword = (data) => API.post("/auth/forgot-password", data);
export const changePassword = (data) =>
  API.put("/auth/change-password", data);

export const deleteAccount = (data) =>
  API.delete("/auth/delete-account", { data });

export const updateProfile = (data) =>
  API.put("/auth/update-profile", data);

export const reorderNotes = (data) =>
  API.patch("/notes/reorder", data);

export const updateCategory = (id, category) =>
  API.patch(`/notes/${id}/category`, { category });

// ✅ Notes
export const getNotes = () => API.get("/notes");
export const createNote = (data) => API.post("/notes", data);
export const importNotes = (notes) => API.post("/notes/import", { notes });
export const updateNote = (id, data) => API.put(`/notes/${id}`, data);
export const deleteNote = (id) => API.delete(`/notes/${id}`);
export const updateNoteColor = (id, color) => API.patch(`/notes/${id}/color`, { color });
export const togglePinNote = (id) => API.patch(`/notes/${id}/pin`);

function getAudioExtension(mimeType) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "webm";
}

export const uploadVoiceNote = (noteId, recording) => {
  const formData = new FormData();
  const mimeType = recording?.blob?.type || recording?.mimeType || "audio/webm";
  const extension = getAudioExtension(mimeType);

  formData.append(
    "audio",
    recording.blob,
    `voice-note-${Date.now()}.${extension}`,
  );
  formData.append("duration", Math.round(recording.duration || 0));

  return API.post(`/voice-notes/${noteId}`, formData);
};

export const getVoiceNote = (noteId) => API.get(`/voice-notes/${noteId}`);
export const deleteVoiceNote = (voiceId) => API.delete(`/voice-notes/${voiceId}`);

export default API;
