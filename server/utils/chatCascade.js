import mongoose from 'mongoose';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';

// Takes a student's id out of every reaction in the groups they belong to, and drops
// emoji left with nobody. One pipeline update, so account deletion stays a single round trip.
export const pullUserReactions = async (userId) => {
    const id = new mongoose.Types.ObjectId(String(userId));
    const groupIds = await groupModel.find({ members: id }).distinct('_id');
    if (!groupIds.length) return;

    await groupMessageModel.updateMany(
        { group: { $in: groupIds }, reactions: { $exists: true, $ne: {} } },
        [{
            $set: {
                reactions: {
                    $arrayToObject: {
                        $filter: {
                            input: {
                                $map: {
                                    input: { $objectToArray: '$reactions' },
                                    as: 'entry',
                                    in: {
                                        k: '$$entry.k',
                                        v: { $filter: { input: '$$entry.v', as: 'who', cond: { $ne: ['$$who', id] } } },
                                    },
                                },
                            },
                            as: 'entry',
                            cond: { $gt: [{ $size: '$$entry.v' }, 0] },
                        },
                    },
                },
            },
        }],
        { updatePipeline: true }
    );
};
