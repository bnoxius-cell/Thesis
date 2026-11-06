// Where a library file lives (plan 19, 2.2): `general`, `subject:<id>` or `folder:<id>`. One parser
// and one ownership check serve upload, list and move, so no route trusts an id it did not check.
import fileFolderModel from '../models/fileFolderModel.js';
import subjectModel from '../models/subjectModel.js';
import { isId } from './httpErrors.js';

export class LocationError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'LocationError';
        this.status = status;
    }
}

const PLACE_MODELS = { subject: subjectModel, folder: fileFolderModel };

// { type: 'general' } or { type, id }; null for anything else, including arrays and objects from a
// query string like `?to[$ne]=x`.
export const parseLocation = (value) => {
    if (typeof value !== 'string') return null;
    if (value === 'general') return { type: 'general' };
    const [type, id, ...extra] = value.split(':');
    if (!Object.hasOwn(PLACE_MODELS, type) || extra.length || !isId(id)) return null;
    return { type, id };
};

// The refs to store on a row, after checking the place is this student's own. Another student's
// id and an unknown id answer the same 404.
export const resolveLocation = async (userId, value) => {
    const location = parseLocation(value);
    if (!location) throw new LocationError(400, 'Pick where to put it.');
    if (location.type === 'general') return { subject: null, folder: null };
    // An archived subject isn't listed as a place, so it can't be a target either.
    const owned = location.type === 'subject' ? { archivedAt: null } : {};
    if (!await PLACE_MODELS[location.type].exists({ _id: location.id, owner: userId, ...owned })) throw new LocationError(404, 'Not found.');
    return { subject: null, folder: null, [location.type]: location.id };
};

export const locationOf = (row) => {
    if (row.subject) return { type: 'subject', id: String(row.subject) };
    if (row.folder) return { type: 'folder', id: String(row.folder) };
    return { type: 'general' };
};

// The only shape of a library file that leaves the server: no object keys, state, bytes or owner.
export const publicFile = (row) => ({
    id: String(row._id),
    name: row.name,
    ext: row.ext,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    hasThumb: Boolean(row.thumbStorageId),
    createdAt: row.createdAt,
    location: locationOf(row),
});
