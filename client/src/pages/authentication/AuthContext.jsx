import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { clearFileLinks } from "@/shared/lib/fileLinks";
import { detachPush } from "../../utils/pushClient";

export const AppContext = createContext();

// In production, use Vercel's same-origin /api rewrite so the session cookie
// stays first-party. Local development still talks directly to Express.
axios.defaults.withCredentials = true;

export const AppContextProvider = (props) => {
  const backendUrl = import.meta.env.DEV ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000") : "";
  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null); // null = not loaded
  const [loading, setLoading] = useState(true);
  const signedInId = useRef(null); // whose file links this tab holds

  // Fetch user data
  const getUserData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/data');
      if (data.success) {
        if (signedInId.current && signedInId.current !== data.userData._id) clearFileLinks();
        signedInId.current = data.userData._id;
        setUserData(data.userData);
        return data.userData;
      } else {
        toast.error(data.message);
        return null;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  // Check authentication state
  // `silent` skips the global loading state so the auth page (and the Google button iframe)
  // isn't swapped out for a spinner while refreshing after a login.
  const getAuthState = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/is-authenticated');
      if (data.success) {
        const user = await getUserData();
        if (user && user.isAccountVerified) {
          setIsLoggedin(true);
        } else {
          setIsLoggedin(false);
        }
      } else {
        clearFileLinks(); // the session ended without a sign-out, maybe in another tab
        signedInId.current = null;
        setIsLoggedin(false);
        setUserData(null);
      }
    } catch (error) {
      console.error("Auth check failed", error);
      setIsLoggedin(false);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  // Standard email/password login. An unverified account still gets a session cookie
  // (the verify endpoints need it), plus a fresh code by email, but isn't logged in yet.
  const login = async (email, password, rememberMe = false) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/login', { email, password, rememberMe });
      if (!data.success) {
        toast.error(data.message);
        return { success: false };
      }
      await getAuthState({ silent: true }); // re‑fetch user & login status
      if (data.needsVerification) {
        (data.otpSent ? toast.info : toast.warn)(data.message);
        return { success: true, needsVerification: true, otpSent: data.otpSent };
      }
      toast.success("Logged in successfully");
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false };
    }
  };

  // Standard email/password registration. The backend emails a verification code;
  // the account isn't logged in until that code is entered.
  const register = async (name, email, password, acceptedTerms) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/register', { name, email, password, acceptedTerms });
      if (!data.success) {
        toast.error(data.message);
        return { success: false };
      }
      await getAuthState({ silent: true }); // picks up the new (unverified) user for the verify step
      (data.otpSent ? toast.success : toast.warn)(data.message);
      return { success: true, needsVerification: true, otpSent: data.otpSent };
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false };
    }
  };

  // Google login
  const googleLogin = async (credentialToken) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/google', { token: credentialToken });
      if (data.success) {
        await getAuthState({ silent: true });
        toast.success("Google sign‑in successful");
        return true;
      } else {
        toast.error(data.message);
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  // Logout. Landing on the sign-in page is the confirmation, so there is no success toast.
  const logout = async () => {
    try {
      // Needs the session cookie, so it has to happen before the logout request.
      await detachPush(backendUrl);
      const { data } = await axios.post(backendUrl + '/api/auth/logout');
      if (data.success) {
        clearFileLinks();
        signedInId.current = null;
        setIsLoggedin(false);
        setUserData(null);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Initial auth check
  useEffect(() => {
    getAuthState();
  }, []);

  const value = {
    backendUrl,
    isLoggedin,
    setIsLoggedin,
    userData,
    user: userData,
    setUserData,
    getUserData,
    login,
    register,
    googleLogin,
    logout,
    loading,
  };

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
};

export const useAuth = () => useContext(AppContext);
