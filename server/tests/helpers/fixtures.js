// Valid-by-default payloads so each test only overrides the field it cares about.
export const validRegisterPayload = (overrides = {}) => ({
    name: 'Test Student',
    email: 'test.student@student.fatima.edu.ph',
    password: 'Password123',
    ...overrides,
});
