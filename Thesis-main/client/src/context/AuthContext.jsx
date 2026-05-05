import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../auth.service";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    return new Promise((resolve, reject) => {
      authService.login(email, password).subscribe({
        next: (res) => {
          authService.setAuthData(res.token, res.user);
          setUser(res.user);
          resolve(res);
        },
        error: (err) => reject(err),
      });
    });
  };

  const register = (name, email, password) => {
    return new Promise((resolve, reject) => {
      authService.register(name, email, password).subscribe({
        next: (res) => {
          authService.setAuthData(res.token, res.user);
          setUser(res.user);
          resolve(res);
        },
        error: (err) => reject(err),
      });
    });
  };

  const continueAsGuest = () => {
    const guestUser = {
      _id: "guest_" + Date.now(),
      name: "Guest Student",
      email: "guest@stresscare.io",
      authProvider: "local",
    };
    setUser(guestUser);
    // Optional: persist guest session to local storage
    localStorage.setItem("user", JSON.stringify(guestUser));
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, continueAsGuest, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);