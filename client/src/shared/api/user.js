import { get, post, put } from "./http";

// The guide endpoints answer { success: true, ... }. Anything else (the signed-out 200 with
// success: false, a proxy page) counts as a failure, so callers only handle { data } or { error }.
const succeeded = (res) => (res.data?.success === true ? res : { error: res.error || "Something went wrong. Please try again." });

// Saves part of the signed-in student's profile. Answers { data } or { error }.
export const updateProfile = (fields) => put("/api/user/profile", fields);

// Saves the signed-in student's picture: a small JPEG data URL from compressImage(file, AVATAR_PICTURE),
// or "" to go back to the initial. Answers { data: { avatar } } or { error }.
export const updateAvatar = (avatar) => put("/api/user/avatar", { avatar });

// Another student's profile, for friends and people who share a group with the student:
// { profile }. It has _id, name, avatar, program, bio, profileTag, relation ("none" | "sent" |
// "received" | "friends"), requestId (set when relation is "received") and sharedGroups ([{ _id,
// name }], no member count). A 403 means the student has no link to that person, a 404 an unknown id.
export const fetchProfile = (userId) => get(`/api/user/profile/${userId}`);

// Saves one step of the welcome tour and Get started card: "welcome-done", "setup-hide" or "setup-show".
// Answers { data: { guide } } (the new flags) or { error }.
export const saveGuide = async (action) => succeeded(await post("/api/user/guide", { action }));

// Which Get started steps the student has done. Answers { data: { steps: { classes, task, checkin,
// reviewer }, done } } or { error }.
export const fetchSetup = async () => succeeded(await get("/api/user/setup"));
