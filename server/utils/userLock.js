// Runs work for one key (a user's id) one at a time, in the order it was asked for, so two requests from the
// same student can't both read "no subject yet" and both make one. In-memory, so it covers one server
// process: the API runs as a single instance.
const queues = new Map();

export const withUserLock = (key, work) => {
    const previous = queues.get(key) ?? Promise.resolve();
    const run = previous.then(() => work());
    // The queue waits for this run however it ends, and forgets the key once nothing is waiting behind it.
    const settled = run.then(() => {}, () => {});
    queues.set(key, settled);
    settled.then(() => {
        if (queues.get(key) === settled) queues.delete(key);
    });
    return run;
};
