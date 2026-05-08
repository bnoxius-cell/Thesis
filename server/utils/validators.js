export const validateEmail = (email) => {
    // Standard email regex pattern
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const validateRegisterFields = (name, email, password) => {
    if (!name || !email || !password) {
        return { isValid: false, }
        return { isValid: false, message: "All fields must be filled." };
    }

    if (!validateEmail(email)) {
        return { isValid: false, message: "Invalid email." };
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
        return res.json({ isValid: false, message: 'Email is required'})
    }
    if (!newPassword) {
        return res.json({ isValid: false, message: 'New password is required' })
    }
    if (!otp) {
        return res.json({ isValid: false, message: 'OTP is required' })
    }
    return { isValid: true };
};