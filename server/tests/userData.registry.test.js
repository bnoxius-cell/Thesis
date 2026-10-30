import { describe, test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { USER_DATA } from '../utils/userData.js';

const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'models');

// Every path in a schema (inside sub-documents and arrays too) that points at a user.
const userPaths = (schema, prefix = '') => {
    const found = [];
    schema.eachPath((name, type) => {
        const full = `${prefix}${name}`;
        const embedded = type.getEmbeddedSchemaType?.();
        if (type.schema) found.push(...userPaths(type.schema, `${full}.`));
        else if (type.options?.ref === 'user' || embedded?.options?.ref === 'user') found.push(full);
    });
    return found;
};

const loadModels = async () => {
    const files = readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js'));
    const models = new Map();
    for (const file of files) {
        const exported = await import(pathToFileURL(path.join(MODELS_DIR, file)).href);
        Object.values(exported)
            .filter((value) => typeof value?.modelName === 'string')
            .forEach((model) => models.set(model.modelName, model));
    }
    return models;
};

describe('user data registry', () => {
    test('lists every model path that holds a user id', async () => {
        const listed = new Set(USER_DATA.map(({ model, field }) => `${model.modelName}.${field}`));
        const missing = [];
        for (const model of (await loadModels()).values()) {
            userPaths(model.schema).forEach((field) => {
                if (!listed.has(`${model.modelName}.${field}`)) missing.push(`${model.modelName}.${field}`);
            });
        }
        expect(missing, 'add these to USER_DATA in server/utils/userData.js').toEqual([]);
    });

    test('only lists paths that exist', async () => {
        const models = await loadModels();
        for (const { model, field } of USER_DATA) {
            expect(userPaths(models.get(model.modelName).schema), `${model.modelName}.${field}`).toContain(field);
        }
    });

    test('every entry says what happens to it', () => {
        USER_DATA.forEach((entry) => expect(['delete', 'pending']).toContain(entry.how));
    });
});
