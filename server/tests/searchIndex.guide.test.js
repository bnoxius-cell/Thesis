import { describe, expect, it } from 'vitest';
import { buildSearchIndex, searchEntries } from '../../client/src/app/shell/searchIndex.js';
import { GUIDE_TOPICS } from '../../client/src/features/guide/guideTopics.js';
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from '../../client/src/utils/workload.js';

const entries = buildSearchIndex({});
const find = (query) => searchEntries(entries, query).map((entry) => entry.label);

describe('guide topics', () => {
    it('has six topics, each with an id, a title, 2 to 4 steps and a place to go', () => {
        expect(GUIDE_TOPICS).toHaveLength(6);
        expect(new Set(GUIDE_TOPICS.map((topic) => topic.key)).size).toBe(6);
        for (const topic of GUIDE_TOPICS) {
            expect(topic.key).toBeTruthy();
            expect(topic.title).toBeTruthy();
            expect(topic.steps.length).toBeGreaterThanOrEqual(2);
            expect(topic.steps.length).toBeLessThanOrEqual(4);
            expect(topic.goTo.to).toMatch(/^\//);
            expect(topic.goTo.label).toBeTruthy();
        }
    });

    it('quotes the check-in validity from the workload constants', () => {
        const checkin = GUIDE_TOPICS.find((topic) => topic.key === 'checkin').steps.join(' ');
        expect(checkin).toContain(`${PSS_VALID_DAYS} days`);
        expect(checkin).toContain(`${WHO_VALID_DAYS} days`);
    });
});

describe('search index guide entries', () => {
    it('finds the classes topic by "add class"', () => {
        expect(find('add class')).toContain('Add your classes and timetable');
    });

    it('finds the check-in topic by "check-in"', () => {
        expect(find('check-in')).toContain('Do a check-in');
    });

    it('links each topic to its anchor on the Help page', () => {
        const topics = entries.filter((entry) => entry.kind === 'guide' && entry.sub === 'How to');
        expect(topics).toHaveLength(GUIDE_TOPICS.length);
        for (const entry of topics) expect(entry.to).toMatch(/^\/settings\/help#guide-[a-z]+$/);
    });

    it('has a Take the tour entry that starts the tour', () => {
        const tour = entries.find((entry) => entry.label === 'Take the tour');
        expect(tour).toMatchObject({ kind: 'guide', to: '/home?tour=1' });
        expect(find('tour')).toContain('Take the tour');
    });
});
