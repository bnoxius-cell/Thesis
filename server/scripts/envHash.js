// Prints the configHash of the env this server sees, so two backends can be compared by running it
// in each one's shell. Reads server/.env like the other scripts. Prints the hash and the names of
// any hashed variables that are empty. Never prints a value.
//
//   npm run env:hash
import { pathToFileURL } from 'url';
import { configHash, CONFIG_HASH_KEYS } from '../utils/configHash.js';

const runFromCommandLine = async () => {
    await import('dotenv/config');
    console.log(configHash(process.env));

    const empty = CONFIG_HASH_KEYS.filter((name) => !process.env[name]);
    if (empty.length) console.log(`Empty: ${empty.join(', ')}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runFromCommandLine().catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
