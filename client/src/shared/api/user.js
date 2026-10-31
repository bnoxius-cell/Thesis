import { put } from "./http";

// Saves part of the signed-in student's profile. Answers { data } or { error }.
export const updateProfile = (fields) => put("/api/user/profile", fields);
