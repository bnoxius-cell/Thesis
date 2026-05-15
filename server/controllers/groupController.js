import groupModel from '../models/groupMode.js';

export const createGroup = async (req, res) => {
    try {
        const { name, description } = req.body;
        const newGroup = new groupModel({
            name,
            description,
            admin: req.userId,
            members: [req.userId]
        });

        await newGroup.save();
        res.json({ success: true, message: 'Group created successfully', group: newGroup });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const getGroups = async (req, res) => {
    try {
        const groups = await groupModel.find({ members: req.userId })
            .populate('admin', 'name email avatar')
            .populate('members', 'name email avatar');
            
        res.json({ success: true, groups });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const joinGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const group = await groupModel.findById(groupId);
        
        if (!group) return res.json({ success: false, message: 'Group not found' });
        if (group.members.includes(req.userId)) {
            return res.json({ success: false, message: 'Already a member of this group' });
        }

        group.members.push(req.userId);
        await group.save();
        res.json({ success: true, message: 'Joined group successfully', group });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const group = await groupModel.findById(req.body.groupId);
        if (!group) return res.json({ success: false, message: 'Group not found' });
        if (group.admin.toString() === req.userId) {
            return res.json({ success: false, message: 'Admin cannot leave the group. Delete it instead.' });
        }
        group.members = group.members.filter(member => member.toString() !== req.userId);
        await group.save();
        res.json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        const group = await groupModel.findOneAndDelete({ _id: req.params.groupId, admin: req.userId });
        if (!group) return res.json({ success: false, message: 'Group not found or unauthorized' });
        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};