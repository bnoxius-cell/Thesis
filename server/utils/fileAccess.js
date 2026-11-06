// Who may get a link to a stored file (plan 18, 3.6). Checked again on every request, so a member
// who leaves a group loses access at once. Routes answer 404 whenever this says no.
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';

// chat: a member of the file's group right now, and the message is still there (not a tombstone)
// in that same group. library: the owner only. Anything else: no.
export const canRead = async (userId, file) => {
    if (!userId || !file) return false;
    if (file.scope === 'library') return String(file.owner) === String(userId);
    if (file.scope !== 'chat' || !file.group || !file.message) return false;
    const [member, message] = await Promise.all([
        groupModel.exists({ _id: file.group, members: userId }),
        groupMessageModel.exists({ _id: file.message, group: file.group, deletedAt: null }),
    ]);
    return Boolean(member && message);
};
