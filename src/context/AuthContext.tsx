import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  hasAdmin: boolean;
  isCloudConnected: boolean;
  signIn: (email: string, pass: string, rememberMe?: boolean) => Promise<{ error: string | null }>;
  signUp: (email: string, pass: string, fullName: string) => Promise<{ error: string | null }>;
  signUpFirstAdmin: (email: string, pass: string, fullName: string) => Promise<{ error: string | null }>;
  createStaffAccount: (email: string, pass: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  getAllUsers: () => Promise<UserProfile[]>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: 'Staff',
  loading: true,
  hasAdmin: true,
  isCloudConnected: false,
  signIn: async () => ({ error: 'Auth not initialized' }),
  signUp: async () => ({ error: 'Auth not initialized' }),
  signUpFirstAdmin: async () => ({ error: 'Auth not initialized' }),
  createStaffAccount: async () => ({ error: 'Auth not initialized' }),
  signOut: async () => {},
  resetPassword: async () => ({ error: 'Auth not initialized' }),
  getAllUsers: async () => [],
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('Admin');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);

  // Helper to check if any Admin user exists in database / local storage
  const checkHasAdmin = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'Admin');

        if (!error && typeof count === 'number') {
          setHasAdmin(count > 0);
          return;
        }
      } catch (err) {
        console.warn('Error checking Supabase admin profiles:', err);
      }
    }

    // Local fallback check
    const localUsersStr = localStorage.getItem('cod_registered_users');
    if (localUsersStr) {
      try {
        const localUsers: UserProfile[] = JSON.parse(localUsersStr);
        const adminFound = localUsers.some((u) => u.role === 'Admin');
        setHasAdmin(adminFound);
        return;
      } catch {}
    }

    // Default: if saved demo user exists, hasAdmin is true
    const savedDemo = localStorage.getItem('cod_auth_demo_user') || sessionStorage.getItem('cod_auth_demo_user');
    setHasAdmin(!!savedDemo);
  };

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsCloudConnected(configured);

    const initAuth = async () => {
      await checkHasAdmin();

      if (!configured || !supabase) {
        // Local fallback session restore
        const savedUserStr = localStorage.getItem('cod_auth_demo_user') || sessionStorage.getItem('cod_auth_demo_user');
        if (savedUserStr) {
          try {
            const parsed: UserProfile = JSON.parse(savedUserStr);
            setUser(parsed);
            setProfile(parsed);
            setRole(parsed.role || 'Admin');
          } catch {
            setUser(null);
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
        return;
      }

      // Supabase Auth Session restore
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Error restoring Supabase auth session:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    if (configured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        const userProf: UserProfile = {
          id: data.id,
          email: data.email || email,
          role: (data.role as UserRole) || 'Staff',
          fullName: data.full_name || email.split('@')[0],
          createdAt: data.created_at,
        };
        setProfile(userProf);
        setRole(userProf.role);
      } else {
        // Create profile if missing
        const newProf: UserProfile = {
          id: userId,
          email,
          role: 'Staff',
          fullName: email.split('@')[0],
        };
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: newProf.fullName,
          role: 'Staff',
        });
        setProfile(newProf);
        setRole('Staff');
      }
    } catch (err) {
      console.error('Failed fetching user profile:', err);
    }
  };

  const signIn = async (email: string, pass: string, rememberMe = true) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local mode sign-in
      const storedUsersStr = localStorage.getItem('cod_registered_users');
      let matchedProf: UserProfile | null = null;
      if (storedUsersStr) {
        try {
          const list: UserProfile[] = JSON.parse(storedUsersStr);
          matchedProf = list.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
        } catch {}
      }

      if (!matchedProf) {
        const defaultRole: UserRole = email.toLowerCase().includes('staff') ? 'Staff' : 'Admin';
        matchedProf = {
          id: `demo_${Date.now()}`,
          email,
          role: defaultRole,
          fullName: email.split('@')[0],
        };
      }

      if (rememberMe) {
        localStorage.setItem('cod_auth_demo_user', JSON.stringify(matchedProf));
      } else {
        sessionStorage.setItem('cod_auth_demo_user', JSON.stringify(matchedProf));
      }

      setUser(matchedProf);
      setProfile(matchedProf);
      setRole(matchedProf.role);
      setHasAdmin(true);
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Authentication failed' };
    }
  };

  const signUp = async (email: string, pass: string, fullName: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local mode sign-up
      const newProf: UserProfile = {
        id: `user_${Date.now()}`,
        email,
        role: 'Admin',
        fullName,
      };

      const existingStr = localStorage.getItem('cod_registered_users');
      let list: UserProfile[] = [];
      if (existingStr) {
        try {
          list = JSON.parse(existingStr);
        } catch {}
      }
      list.push(newProf);
      localStorage.setItem('cod_registered_users', JSON.stringify(list));
      localStorage.setItem('cod_auth_demo_user', JSON.stringify(newProf));

      setUser(newProf);
      setProfile(newProf);
      setRole('Admin');
      setHasAdmin(true);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: 'Admin',
          },
        },
      });

      if (error) return { error: error.message };

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'Admin',
        });
      }

      if (data.session?.user) {
        setUser(data.session.user);
        await fetchUserProfile(data.session.user.id, data.session.user.email || email);
      } else if (data.user) {
        // Sign in immediately after signup if session wasn't auto created
        await supabase.auth.signInWithPassword({ email, password: pass });
      }

      setHasAdmin(true);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Account creation failed' };
    }
  };

  const signUpFirstAdmin = async (email: string, pass: string, fullName: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local mode initial admin creation
      const adminProf: UserProfile = {
        id: `admin_${Date.now()}`,
        email,
        role: 'Admin',
        fullName,
      };

      const users: UserProfile[] = [adminProf];
      localStorage.setItem('cod_registered_users', JSON.stringify(users));
      localStorage.setItem('cod_auth_demo_user', JSON.stringify(adminProf));

      setUser(adminProf);
      setProfile(adminProf);
      setRole('Admin');
      setHasAdmin(true);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: 'Admin',
          },
        },
      });

      if (error) return { error: error.message };

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'Admin',
        });
      }

      setHasAdmin(true);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed' };
    }
  };

  const createStaffAccount = async (email: string, pass: string, fullName: string, selectedRole: UserRole) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local mode staff creation
      const newProf: UserProfile = {
        id: `user_${Date.now()}`,
        email,
        role: selectedRole,
        fullName,
      };

      const existingStr = localStorage.getItem('cod_registered_users');
      let list: UserProfile[] = [];
      if (existingStr) {
        try {
          list = JSON.parse(existingStr);
        } catch {}
      }
      list.push(newProf);
      localStorage.setItem('cod_registered_users', JSON.stringify(list));
      return { error: null };
    }

    try {
      // Call Supabase sign up (or create profile record)
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: selectedRole,
          },
        },
      });

      if (error) return { error: error.message };

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: selectedRole,
        });
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'User creation failed' };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('cod_auth_demo_user');
    sessionStorage.removeItem('cod_auth_demo_user');
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        error: null,
        message: 'Local Demo Mode: In Supabase Cloud mode, a password reset link will be sent to your email.',
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) return { error: error.message };
      return { error: null, message: 'Password reset link sent to ' + email };
    } catch (err: any) {
      return { error: err?.message || 'Failed to send reset email.' };
    }
  };

  const getAllUsers = async (): Promise<UserProfile[]> => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            email: d.email || '',
            fullName: d.full_name || d.email,
            role: (d.role as UserRole) || 'Staff',
            createdAt: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Failed querying profiles:', err);
      }
    }

    const localUsersStr = localStorage.getItem('cod_registered_users');
    if (localUsersStr) {
      try {
        return JSON.parse(localUsersStr);
      } catch {}
    }

    if (profile) {
      return [profile];
    }
    return [];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        hasAdmin,
        isCloudConnected,
        signIn,
        signUp,
        signUpFirstAdmin,
        createStaffAccount,
        signOut,
        resetPassword,
        getAllUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
