import { del, get, post, put } from "./http";

// Every call answers { data } or { error } (see http.js). People come back as { _id, name, avatar,
// profileTag }; no email or check-in result is ever included.

// The student's friends: { friends }.
export const fetchFriends = () => get("/api/friends");

// Requests waiting for the student's answer: { requests }, each { _id, user }.
export const fetchIncoming = () => get("/api/friends/pending");

// Requests the student sent that nobody has answered yet: { requests }, each { _id, friend }.
export const fetchSent = () => get("/api/friends/sent");

// Asks someone to be friends, by the friend code they shared or by their id (from their profile).
// If they had already asked, it accepts instead and the answer carries `accepted: true`.
export const requestByCode = (profileTag) => post("/api/friends/request", { profileTag });
export const requestByUser = (userId) => post("/api/friends/request", { userId });

export const acceptRequest = (requestId) => put(`/api/friends/accept/${requestId}`, {});

// The receiver declines, or the sender cancels. Nobody else can touch the request.
export const dropRequest = (requestId) => del(`/api/friends/request/${requestId}`);

export const removeFriend = (friendId) => del(`/api/friends/${friendId}`);
