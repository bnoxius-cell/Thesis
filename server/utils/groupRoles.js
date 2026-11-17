// Who is who in a group. The owner (`admin`) made the group; `admins` are the members the owner promoted.
export const sameId = (a, b) => String(a) === String(b);
export const isMember = (group, userId) => group.members.some((member) => sameId(member, userId));
export const isOwner = (group, userId) => sameId(group.admin, userId);
// The owner is always an admin.
export const isAdmin = (group, userId) => isOwner(group, userId) || (group.admins || []).some((a) => sameId(a, userId));
