import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api",
});

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
export const updateNote = (id, data) => API.put(`/notes/${id}`, data);
export const deleteNote = (id) => API.delete(`/notes/${id}`);
export const updateNoteColor = (id, color) => API.patch(`/notes/${id}/color`, { color });
export const togglePinNote = (id) => API.patch(`/notes/${id}/pin`);

export default API;