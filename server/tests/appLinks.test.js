import { describe, test, expect } from 'vitest';
import { homeLink, peopleLink, friendsLink, groupLink, timetableLink } from '../utils/appLinks.js';

describe('appLinks', () => {
    test('fixed pages point at the new client paths', () => {
        expect(homeLink()).toBe('/home');
        expect(peopleLink()).toBe('/people');
        expect(friendsLink()).toBe('/people/friends');
    });

    test('ids are put into the group and timetable links', () => {
        expect(groupLink('abc123')).toBe('/people/groups/abc123');
        expect(timetableLink('abc123')).toBe('/plan?timetable=abc123');
    });
});
