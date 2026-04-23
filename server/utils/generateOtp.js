// Generates a random 6-digit string
export const generateOtp = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
};