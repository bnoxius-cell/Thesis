import { createContext, useContext, useState, useEffect } from "react"; // 👉 Added useContext here
import axios from "axios";
import { toast } from "react-toastify";

export const AppContext = createContext();

export const AppContextProvider = (props) => {
  // Configures Axios to always send cookies (like the JWT token) with every request
  axios.defaults.withCredentials = true;

  // Global state variables
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(false);

  // Function to fetch the logged-in user's data (name, email, verification status)
  const getUserData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/data');
      if (data.success) {
        setUserData(data.userData);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Function to check if the user's authentication token is valid on page load
  const getAuthState = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/is-authenticated');
      if (data.success) {
        const userRes = await axios.get(backendUrl + '/api/user/data');
        if (userRes.data.success) {
          setUserData(userRes.data.userData);
          if (userRes.data.userData.isAccountVerified) {
            setIsLoggedin(true);
          }
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Automatically check the auth state when the application first loads
  useEffect(() => {
    getAuthState();
  }, []);

  // Function to handle user logout
  const logout = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/auth/logout');
      if (data.success) {
        setIsLoggedin(false);
        setUserData(false);
        toast.success('Logged out successfully');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Pack everything into a value object to share across the app
  const value = {
    backendUrl,
    isLoggedin,
    setIsLoggedin,
    userData,
    user: userData,
    setUserData,
    getUserData,
    logout,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

// 👉 ...so you MUST use AppContext here!
export const useAuth = () => useContext(AppContext);