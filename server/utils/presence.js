// Who has a group's plan open right now, kept in memory only. The plan stamp poll writes it every
// few seconds, so losing it on a restart or a backend switch costs nothing: it fills again on the
// next polls. Ids only; the client already has every member's name and picture.
export const PRESENCE_FRESH_MS = 15 * 1000;
const MAX_USERS_PER_GROUP = 50;
const MAX_GROUPS = 2000;

// groupId -> Map(userId -> { at, editing }). Each inner map is kept in last-seen order (oldest
// first), so stale entries and the entry to drop when full are always at the front.
const groups = new Map();

const isFresh = (entry, now) => now - entry.at < PRESENCE_FRESH_MS;

const dropStale = (people, now) => {
    for (const [userId, entry] of people) {
        if (isFresh(entry, now)) break;
        people.delete(userId);
    }
};

const makeRoomForGroup = (now) => {
    for (const [groupId, people] of groups) {
        dropStale(people, now);
        if (!people.size) groups.delete(groupId);
    }
    while (groups.size >= MAX_GROUPS) groups.delete(groups.keys().next().value);
};

// Records that `userId` has the plan open, and which task they are editing (or null).
export const seen = (groupId, userId, editing = null, now = Date.now()) => {
    const groupKey = String(groupId);
    let people = groups.get(groupKey);
    if (!people) {
        if (groups.size >= MAX_GROUPS) makeRoomForGroup(now);
        people = new Map();
        groups.set(groupKey, people);
    }
    const userKey = String(userId);
    people.delete(userKey); // re-inserted at the end: newest last
    dropStale(people, now);
    while (people.size >= MAX_USERS_PER_GROUP) people.delete(people.keys().next().value);
    people.set(userKey, { at: now, editing: editing ? String(editing) : null });
};

// [{ userId, editing }] for everyone seen in the last 15 s, oldest first.
export const present = (groupId, now = Date.now()) => {
    const groupKey = String(groupId);
    const people = groups.get(groupKey);
    if (!people) return [];
    dropStale(people, now);
    if (!people.size) {
        groups.delete(groupKey);
        return [];
    }
    return [...people].map(([userId, { editing }]) => ({ userId, editing }));
};

// For tests.
export const resetPresence = () => groups.clear();
