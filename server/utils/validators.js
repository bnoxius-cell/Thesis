// Any well-formed email. Used for StressCare accounts made with email + password.
export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim().toLowerCase());
};

export const MIN_PASSWORD_LENGTH = 8;

// The one rule for every password a user chooses (sign-up and reset).
export const validateNewPassword = (password) => {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return { isValid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }
    return { isValid: true };
};

export const validateRegisterFields = (name, email, password) => {
    if (!name || !email || !password) {
        return { isValid: false, message: "All fields must be filled." };
    }

    if (!validateEmail(email)) {
        return { isValid: false, message: "Please enter a valid email address." };
    }

    return validateNewPassword(password);
};


export const validateLoginFields = (email, password) => {
    if (!email) {
        return { isValid: false, message: "Email is required." };
    }

    if (!password) {
        return { isValid: false, message: "Password is required." };
    }

    return { isValid: true };
};

export const validateVerifyEmailFields = (userId, otp) => {
    if (!userId) {
        return { isValid: false, message: "User ID is required." };
    }

    if (!otp) {
        return { isValid: false, message: "Please enter a valid OTP" };
    }

    return { isValid: true };
};

export const validateResetPasswordFields = (email, otp, password) => {
    if (!email) {
        return { isValid: false, message: 'Email is required' };
    }
    if (!password) {
        return { isValid: false, message: 'New password is required' };
    }
    if (!otp) {
        return { isValid: false, message: 'OTP is required' };
    }
    return validateNewPassword(password);
};