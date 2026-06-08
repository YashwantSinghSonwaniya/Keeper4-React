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

// ✅ Notes
export const getNotes = () => API.get("/notes");
export const createNote = (data) => API.post("/notes", data);
export const updateNote = (id, data) => API.put(`/notes/${id}`, data);
export const deleteNote = (id) => API.delete(`/notes/${id}`);
export const updateNoteColor = (id, color) => API.patch(`/notes/${id}/color`, { color });
export const togglePinNote = (id) => API.patch(`/notes/${id}/pin`);

export default API;