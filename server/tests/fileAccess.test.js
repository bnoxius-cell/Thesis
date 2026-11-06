import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import userModel from '../models/userModel.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import { canRead } from '../utils/fileAccess.js';

beforeAll(connectTestDB);
afterAll(closeTestDB);

let owner;
let member;
let outsider;
let group;
let message;
beforeEach(async () => {
    await clearTestDB();
    [owner, member, outsider] = await Promise.all(['a', 'b', 'c'].map((name) => userModel.create({ name, email: `${name}@student.fatima.edu.ph` })));
    group = await groupModel.create({ name: 'Study', admin: owner._id, members: [owner._id, member._id] });
    message = await groupMessageModel.create({ group: group._id, sender: owner._id, text: 'here' });
});

const chatFile = (overrides = {}) => ({ scope: 'chat', owner: owner._id, group: group._id, message: message._id, ...overrides });

describe('canRead', () => {
    test('chat: members of the group can read while the message exists', async () => {
        expect(await canRead(member._id, chatFile())).toBe(true);
        expect(await canRead(String(owner._id), chatFile())).toBe(true);
    });

    test('chat: a non-member, or a member who left, cannot', async () => {
        expect(await canRead(outsider._id, chatFile())).toBe(false);
        await groupModel.updateOne({ _id: group._id }, { $pull: { members: member._id } });
        expect(await canRead(member._id, chatFile())).toBe(false);
    });

    test('chat: a deleted message, or one from another group, closes the file', async () => {
        const other = await groupModel.create({ name: 'Other', admin: owner._id, members: [owner._id, member._id] });
        const elsewhere = await groupMessageModel.create({ group: other._id, sender: owner._id, text: 'x' });
        expect(await canRead(member._id, chatFile({ message: elsewhere._id }))).toBe(false);

        await groupMessageModel.updateOne({ _id: message._id }, { $set: { type: 'deleted', deletedAt: new Date() } });
        expect(await canRead(member._id, chatFile())).toBe(false);
        expect(await canRead(member._id, chatFile({ message: new mongoose.Types.ObjectId() }))).toBe(false);
    });

    test('library: only the owner', async () => {
        const file = { scope: 'library', owner: owner._id, subject: new mongoose.Types.ObjectId() };
        expect(await canRead(owner._id, file)).toBe(true);
        expect(await canRead(member._id, file)).toBe(false);
    });

    test('anything else is a no', async () => {
        expect(await canRead(owner._id, { ...chatFile(), scope: 'other' })).toBe(false);
        expect(await canRead(owner._id, chatFile({ group: null }))).toBe(false);
        expect(await canRead(null, chatFile())).toBe(false);
        expect(await canRead(owner._id, null)).toBe(false);
    });
});
