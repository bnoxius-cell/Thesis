import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const AppContext = createContext();

export const AppContextProvider = (props) => {
  axios.defaults.withCredentials = true;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null); // null = not loaded
  const [loading, setLoading] = useState(true);

  // Fetch user data
  const getUserData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/data');
      if (data.success) {
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
  const getAuthState = async () => {
    setLoading(true);
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

  // Standard email/password login
  const login = async (email, password, rememberMe = false) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/login', { email, password, rememberMe });
      if (data.success) {
        await getAuthState(); // re‑fetch user & login status
        toast.success("Logged in successfully");
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

  // Standard email/password registration
  const register = async (name, email, password) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/register', { name, email, password });
      if (data.success) {
        // After registration, the backend sends an OTP – we don't automatically log in yet
        toast.success("Registration successful! Please verify your email.");
        return { success: true, needsVerification: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
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
        await getAuthState();
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

  // Logout
  const logout = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/logout');
      if (data.success) {
        setIsLoggedin(false);
        setUserData(null);
        toast.success("Logged out successfully");
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