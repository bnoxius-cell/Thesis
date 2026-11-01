import { get, put } from "./http";

// Saves part of the signed-in student's profile. Answers { data } or { error }.
export const updateProfile = (fields) => put("/api/user/profile", fields);

// Another student's profile, for friends and people who share a group with the student:
// { profile }. It has _id, name, avatar, program, bio, profileTag, relation ("none" | "sent" |
// "received" | "friends"), requestId (set when relation is "received") and sharedGroups ([{ _id,
// name }], no member count). A 403 means the student has no link to that person, a 404 an unknown id.
export const fetchProfile = (userId) => get(`/api/user/profile/${userId}`);
