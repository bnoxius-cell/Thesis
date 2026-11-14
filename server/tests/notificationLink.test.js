import { describe, test, expect } from 'vitest';
import { toAppLink } from '../../client/src/features/notifications/notificationLink.js';

describe('toAppLink', () => {
    test('maps every link the old site wrote to where the page lives now', () => {
        expect(toAppLink('/friends')).toBe('/people/friends');
        expect(toAppLink('/groups?g=abc123')).toBe('/people/groups/abc123');
        expect(toAppLink('/groups')).toBe('/people');
        expect(toAppLink('/schedule?s=abc123')).toBe('/plan?timetable=abc123');
        expect(toAppLink('/schedule')).toBe('/plan');
        expect(toAppLink('/dashboard')).toBe('/home');
    });

    test('an old link with an empty id falls back to the list page', () => {
        expect(toAppLink('/groups?g=')).toBe('/people');
        expect(toAppLink('/schedule?s=')).toBe('/plan');
    });

    test('other parameters on an old link are dropped, the id is kept', () => {
        expect(toAppLink('/groups?x=1&g=abc123')).toBe('/people/groups/abc123');
    });

    test('links the server writes now pass through unchanged', () => {
        expect(toAppLink('/people/friends')).toBe('/people/friends');
        expect(toAppLink('/people/groups/abc123')).toBe('/people/groups/abc123');
        expect(toAppLink('/plan?timetable=abc123')).toBe('/plan?timetable=abc123');
        expect(toAppLink('/plan?view=tasks&task=abc123')).toBe('/plan?view=tasks&task=abc123');
        expect(toAppLink('/home')).toBe('/home');
    });

    test('a path that only starts like an old one is not rewritten', () => {
        expect(toAppLink('/groups/abc123')).toBe('/groups/abc123');
        expect(toAppLink('/friendship')).toBe('/friendship');
    });

    test('surrounding spaces are ignored', () => {
        expect(toAppLink('  /dashboard ')).toBe('/home');
    });

    test('anything that is not a path on this site gives null', () => {
        expect(toAppLink('')).toBeNull();
        expect(toAppLink('   ')).toBeNull();
        expect(toAppLink(undefined)).toBeNull();
        expect(toAppLink(null)).toBeNull();
        expect(toAppLink(42)).toBeNull();
        expect(toAppLink('home')).toBeNull();
        expect(toAppLink('//evil.example/phish')).toBeNull();
        expect(toAppLink('/\\evil.example')).toBeNull();
        expect(toAppLink('http://evil.example')).toBeNull();
        expect(toAppLink('https://evil.example')).toBeNull();
        expect(toAppLink('javascript:alert(1)')).toBeNull();
        expect(toAppLink('data:text/html,hi')).toBeNull();
    });
});
