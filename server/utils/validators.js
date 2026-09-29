// Any well-formed email. Used for StressCare accounts made with email + password.
export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim().toLowerCase());
};

// Fatima student address. Only Google sign-in requires this.
export const validateSchoolEmail = (email) => {
    const re = /^[^\s@]+@student\.fatima\.edu\.ph$/i;
    return re.test(email.trim().toLowerCase());
};

export const validateRegisterFields = (name, email, password) => {
    if (!name || !email || !password) {
        return { isValid: false, message: "All fields must be filled." };
    }

    if (!validateEmail(email)) {
        return { isValid: false, message: "Please enter a valid email address." };
    }

    if (password.length < 8) {
        return { isValid: false, message: "Password must be at least 8 characters." };
    }

    return { isValid: true };
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
    return { isValid: true };
};