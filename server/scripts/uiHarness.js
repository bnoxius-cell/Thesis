// Starts the API on port 5070 against a throwaway in-memory MongoDB, seeded with a realistic
// student and a brand-new one, so the UI can be checked without touching the real database.
//
//   node server/scripts/uiHarness.js
//   VITE_BACKEND_URL=http://localhost:5070 npx vite --port 5174 --strictPort   (in client/)
//
// Accounts (password Password123): maria@student.fatima.edu.ph (full data),
// ana@student.fatima.edu.ph (empty), jose@student.fatima.edu.ph (a friend).
// Never use port 5000: that is the real dev server.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'ui-harness-secret';
process.env.CLIENT_URL = 'http://localhost:5174';
process.env.NODE_ENV = 'development';
process.env.FILES_DEV_MEMORY = 'true'; // files on, in memory, with the dev link route
delete process.env.GEMINI_API_KEY;

const PORT = 5070;
const base = `http://localhost:${PORT}`;

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri());

const { default: app } = await import('../app.js');
const { default: userModel } = await import('../models/userModel.js');
const { default: reviewerModel } = await import('../models/reviewerModel.js');
const { default: flashcardModel } = await import('../models/flashcardModel.js');
const { LEGAL_VERSION } = await import('../utils/legal.js');

app.listen(PORT, () => console.log(`UI harness API on ${base}`));

const hash = await bcrypt.hash('Password123', 8);
const makeUser = (name, email, extra = {}) => userModel.create({
    name, email, password: hash, isAccountVerified: true, termsVersion: LEGAL_VERSION, termsAcceptedAt: new Date(), ...extra,
});

const maria = await makeUser('Maria Santos', 'maria@student.fatima.edu.ph', {
    studyHoursPerDay: 4, sleepHours: 7, usualSleepStart: '23:30', usualWakeTime: '06:30', travelMinutesPerDay: 60,
    lastPSSSubmission: new Date(Date.now() - 3 * 86400000), latestPSSScore: 22,
    lastWHOSubmission: new Date(Date.now() - 2 * 86400000), latestWHOScore: 48,
});
await makeUser('Ana Cruz', 'ana@student.fatima.edu.ph');
const jose = await makeUser('Jose Reyes', 'jose@student.fatima.edu.ph');
const lia = await makeUser('Lia Gomez', 'lia@student.fatima.edu.ph');

const login = async (email) => {
    const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123' }),
    });
    const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    return async (path, method = 'GET', body) => {
        const r = await fetch(`${base}${path}`, {
            method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined,
        });
        return r.json();
    };
};

const api = await login('maria@student.fatima.edu.ph');
const joseApi = await login('jose@student.fatima.edu.ph');
const liaApi = await login('lia@student.fatima.edu.ph');

const day = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(12, 0, 0, 0);
    return d.toISOString().slice(0, 10);
};

// Subjects first, so tasks whose course text matches one are linked to it.
for (const name of ['Capstone Project', 'Information Assurance', 'Web Systems']) {
    await api('/api/subjects', 'POST', { name });
}

const { schedule } = await api('/api/schedules', 'POST', { title: 'My 1st Sem', theme: 'classic' });
const classes = [
    ['Capstone Project', [1, 3], '07:30', '09:00', 'Room 402'],
    ['Information Assurance', [2, 4], '09:30', '11:00', 'Room 305'],
    ['Systems Integration', [1, 3], '13:00', '14:30', 'Lab 2'],
    ['Web Systems', [2, 4], '13:00', '15:00', 'Lab 1', { meetingUrl: 'https://meet.google.com/abc-defg-hij', notes: 'Bring the lab manual.' }],
    ['Social Issues', [5], '08:00', '10:00', 'Room 210'],
    ['Network Admin', [5], '10:30', '12:00', 'Lab 3'],
];
for (const [title, days, startTime, endTime, location, extra] of classes) {
    await api(`/api/schedules/${schedule._id}/entries`, 'POST', { title, kind: 'class', days, startTime, endTime, location, ...extra });
}
await api(`/api/schedules/${schedule._id}/entries`, 'POST', { title: 'Midterm: Information Assurance', kind: 'exam', date: day(3), startTime: '09:30', endTime: '11:00', prepHours: 6 });
await api(`/api/schedules/${schedule._id}/entries`, 'POST', { title: 'Midterm: Web Systems', kind: 'exam', date: day(6), startTime: '13:00', endTime: '15:00', prepHours: 5 });
await api(`/api/schedules/${schedule._id}/entries`, 'POST', { title: 'Org meeting', kind: 'event', date: day(2), startTime: '16:00', endTime: '17:00' });

const tasks = [
    ['Chapter 3 draft', 'Capstone Project', day(2), 5, 4, 5, 'Methodology section, at least five sources.'],
    ['Risk assessment report', 'Information Assurance', day(3), 4, 4, 4],
    ['REST API activity', 'Web Systems', day(1), 3, 3, 3],
    ['Reflection essay', 'Social Issues', day(5), 2, 2, 2],
    ['Network diagram', 'Network Admin', day(-1), 2, 3, 3],
    ['Integration quiz review', 'Systems Integration', day(7), 3, 3, 4],
    ['Buy lab gown', undefined, day(4), 1],
];
for (const [title, course, dueDate, hours, difficulty, importance, description] of tasks) {
    await api('/api/tasks', 'POST', { title, course, dueDate, hours, difficulty, importance, description });
}

await api('/api/friends/request', 'POST', { userId: String(jose._id) });
const pending = await joseApi('/api/friends/pending');
void pending;
const friendList = await joseApi('/api/friends/pending');
if (friendList.requests?.[0]) await joseApi(`/api/friends/accept/${friendList.requests[0]._id}`, 'PUT');
await liaApi('/api/friends/request', 'POST', { userId: String(maria._id) });

// Two timetables Jose shares with Maria, one she can only read and one she can edit. Maria counts
// both in her week so they show up in My week.
const shareWithMaria = async (title, entry, role) => {
    const { schedule: shared } = await joseApi('/api/schedules', 'POST', { title });
    await joseApi(`/api/schedules/${shared._id}/entries`, 'POST', entry);
    await joseApi(`/api/schedules/${shared._id}/share`, 'POST', { userId: String(maria._id), role });
    await api(`/api/schedules/${shared._id}/membership`, 'PUT', { countInWorkload: true });
};
await shareWithMaria('Org officers', { title: 'Officers meeting', kind: 'event', days: [3], startTime: '17:00', endTime: '18:00' }, 'viewer');
await shareWithMaria('Study group', { title: 'Group study', kind: 'activity', days: [6], startTime: '14:00', endTime: '16:00' }, 'editor');

for (const name of ['Capstone Team 4', 'Study Buddies']) {
    const made = await api('/api/groups', 'POST', { name, description: `${name} group chat` });
    await api(`/api/groups/${made.group._id}/messages`, 'POST', { text: 'Hi everyone, meeting at 3 tomorrow?' });
}

// A ready reviewer for Maria, written straight to the model (no Gemini key here), so the Study page
// and the open-reviewer view can be checked.
const EXPLANATION = 'Because it follows from the notes.';
const question = (topic, prompt, options, correctIndex) => ({ topic, prompt, options, correctIndex, explanation: EXPLANATION });
const trueFalse = (topic, prompt, isTrue) => ({ topic, type: 'tf', prompt, options: ['True', 'False'], correctIndex: isTrue ? 0 : 1, explanation: EXPLANATION });
const typed = (type, topic, prompt, answer, accepted = []) => ({ topic, type, prompt, answer, accepted, explanation: EXPLANATION });
const enumeration = (topic, prompt, answers) => ({
    topic, type: 'enum', prompt, items: answers.map((answer) => ({ answer, accepted: [] })), explanation: EXPLANATION,
});
const networkNotes = await reviewerModel.create({
    owner: maria._id, title: 'Network Security notes', course: 'Information Assurance',
    source: { fileName: 'network-security.pdf', pages: 12, chars: 18000 },
    status: 'ready', version: 1, generatedAt: new Date(), aiModel: 'harness', questionType: 'mixed',
    summary: 'How networks are protected: firewalls, encryption in transit and the principle of least privilege.',
    keyPoints: ['A firewall filters traffic by rule.', 'TLS protects data in transit.', 'Give each account only the access it needs.'],
    keyTerms: [{ term: 'Firewall', definition: 'A device or software that filters network traffic.' }, { term: 'TLS', definition: 'A protocol that encrypts data between client and server.' }],
    topics: [{ name: 'Firewalls', summary: 'Rule-based filtering.', parts: [1] }, { name: 'Encryption', summary: 'Protecting data in transit.', parts: [1] }],
    questions: [
        question('Firewalls', 'What does a firewall mainly do?', ['Filters traffic by rule', 'Stores passwords', 'Speeds up Wi-Fi', 'Backs up files'], 0),
        question('Firewalls', 'Where is a network firewall usually placed?', ['At the network edge', 'Inside the printer', 'On the keyboard', 'In the BIOS'], 0),
        question('Encryption', 'What does TLS protect?', ['Data in transit', 'Screen brightness', 'Disk fragmentation', 'Cable length'], 0),
        question('Encryption', 'Least privilege means', ['Only the access that is needed', 'Everyone is admin', 'No passwords', 'Weekly resets'], 0),
        trueFalse('Firewalls', 'A firewall decides what to let through using rules.', true),
        trueFalse('Encryption', 'TLS makes data in transit readable to anyone on the network.', false),
        typed('id', 'Firewalls', 'What do we call a device or software that filters network traffic by rule?', 'Firewall'),
        typed('id', 'Encryption', 'Which protocol encrypts data between a client and a server?', 'TLS', ['Transport Layer Security']),
        typed('fill', 'Firewalls', 'A network firewall is usually placed at the network _____.', 'edge'),
        typed('fill', 'Encryption', 'Data is protected in transit by _____.', 'TLS', ['Transport Layer Security']),
        enumeration('Firewalls', 'Give the 3 things a firewall rule usually checks.', ['Source', 'Destination', 'Port']),
        enumeration('Encryption', 'Give the 3 parts of the CIA triad.', ['Confidentiality', 'Integrity', 'Availability']),
    ],
});

// Two decks for Maria: one from her reviewer through the real route, and a hand-made one where
// half the cards were learned and come back in 2 days (so the tab shows due today and due later).
await api('/api/flashcards/decks/from-reviewer', 'POST', { reviewerId: String(networkNotes._id) });
const { deck: subnetting } = await api('/api/flashcards/decks', 'POST', { title: 'Subnetting' });
const subnettingCards = [
    ['CIDR', 'Classless Inter-Domain Routing: writing a network as an address and a prefix length, like 192.168.1.0/24.'],
    ['Subnet mask', 'Marks which bits of an IPv4 address name the network and which name the host.'],
    ['Default gateway', 'The router a device sends traffic to when the destination is outside its own subnet.'],
    ['Broadcast address', 'The last address in a subnet, used to reach every host on it.'],
    ['Usable hosts in a /26', '62: 64 addresses, minus the network and broadcast addresses.'],
    ['Private ranges', '10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.'],
];
for (const [term, answer] of subnettingCards) {
    await api(`/api/flashcards/decks/${subnetting.id}/cards`, 'POST', { term, answer });
}
const inTwoDays = new Date(Date.now() + 2 * 86400000);
const learned = (await flashcardModel.find({ deck: subnetting.id }).sort({ createdAt: 1 }).limit(3)).map((card) => card._id);
await flashcardModel.updateMany({ _id: { $in: learned } }, { $set: { box: 4, dueAt: inTwoDays, reviewedAt: new Date(), reviews: 4 } });

console.log('Seeded. Log in as maria@student.fatima.edu.ph / Password123 (or ana@ for an empty account).');
