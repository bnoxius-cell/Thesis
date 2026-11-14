import { randomInt } from 'crypto';

// Generates a random 6-digit string from a cryptographically secure source.
export const generateOtp = () => String(randomInt(100000, 1000000));
