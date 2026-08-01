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
  signUp: (email: string, pass: string, fullName: string) => Promise<{ error: string | null; requireEmailVerification?: boolean }>;
  signUpFirstAdmin: (email: string, pass: string, fullName: string) => Promise<{ error: string | null; requireEmailVerification?: boolean }>;
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

  // Helper to check if any Admin user exists in database
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
    setHasAdmin(false);
  };

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsCloudConnected(configured);

    const initAuth = async () => {
      await checkHasAdmin();

      if (!configured || !supabase) {
        setUser(null);
        setProfile(null);
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
        setUser(null);
        setProfile(null);
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
          role: 'Admin',
          fullName: email.split('@')[0],
        };
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: newProf.fullName,
          role: 'Admin',
        });
        setProfile(newProf);
        setRole('Admin');
      }
    } catch (err) {
      console.error('Failed fetching user profile:', err);
    }
  };

  const signIn = async (email: string, pass: string) => {
    if (!supabase) {
      return { error: 'Authentication service unavailable.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        return { error: 'Invalid email or password.' };
      }

      if (data.session?.user) {
        setUser(data.session.user);
        await fetchUserProfile(data.session.user.id, data.session.user.email || email);
        return { error: null };
      }

      return { error: 'Invalid email or password.' };
    } catch (err: any) {
      return { error: 'Invalid email or password.' };
    }
  };

  const signUp = async (email: string, pass: string, fullName: string) => {
    if (!supabase) {
      console.log('[DEBUG SUPABASE SIGNUP] Supabase client is not available or not configured.');
      return { error: 'Authentication service unavailable.', requireEmailVerification: false };
    }

    console.log('[DEBUG SUPABASE SIGNUP BEFORE] Calling supabase.auth.signUp() with params:', {
      email: email.trim(),
      fullName,
    });

    try {
      const response = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      const responseStatus = (response as any).status ?? (response.error ? (response.error as any).status : 200);

      console.log('[DEBUG SUPABASE SIGNUP AFTER] Response received:', response);
      console.log('[DEBUG SUPABASE SIGNUP DETAILS]:', {
        data: response.data,
        error: response.error,
        status: responseStatus,
      });

      const { data, error } = response;

      if (error) {
        console.error('[DEBUG SUPABASE SIGNUP ERROR]', error);
        return { error: error.message || String(error), requireEmailVerification: false };
      }

      if (data?.user) {
        console.log('[DEBUG SUPABASE SIGNUP USER CREATED] User ID:', data.user.id);
        try {
          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email.trim(),
            full_name: fullName,
            role: 'Admin',
          });
          if (profileErr) {
            console.warn('[DEBUG SUPABASE SIGNUP PROFILE UPSERT ERROR]', profileErr);
          } else {
            console.log('[DEBUG SUPABASE SIGNUP PROFILE CREATED SUCCESSFULLY]');
          }
        } catch (profEx) {
          console.warn('[DEBUG SUPABASE SIGNUP PROFILE EXCEPTION]', profEx);
        }
      }

      if (data?.session?.user) {
        console.log('[DEBUG SUPABASE SIGNUP HAS SESSION] User:', data.session.user.id);
        setUser(data.session.user);
        await fetchUserProfile(data.session.user.id, data.session.user.email || email);
        setHasAdmin(true);
        return { error: null, requireEmailVerification: false };
      } else if (data?.user) {
        console.log('[DEBUG SUPABASE SIGNUP NO SESSION (EMAIL CONFIRMATION MAY BE REQUIRED), ATTEMPTING SIGNIN]');
        try {
          const signInRes = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: pass,
          });
          console.log('[DEBUG SUPABASE SIGNUP AUTO SIGNIN RES]', signInRes);
          if (signInRes.data?.session?.user) {
            setUser(signInRes.data.session.user);
            await fetchUserProfile(signInRes.data.session.user.id, email);
            setHasAdmin(true);
            return { error: null, requireEmailVerification: false };
          }
        } catch (signInEx) {
          console.warn('[DEBUG SUPABASE SIGNUP AUTO SIGNIN EXCEPTION]', signInEx);
        }

        setHasAdmin(true);
        return { error: null, requireEmailVerification: true };
      }

      setHasAdmin(true);
      return { error: null, requireEmailVerification: false };
    } catch (err: any) {
      console.error('[DEBUG SUPABASE SIGNUP EXCEPTION]', err);
      const exactMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Account creation failed.';
      return { error: exactMsg, requireEmailVerification: false };
    }
  };

  const signUpFirstAdmin = async (email: string, pass: string, fullName: string) => {
    return signUp(email, pass, fullName);
  };

  const createStaffAccount = async (email: string, pass: string, fullName: string, selectedRole: UserRole) => {
    if (!isSupabaseConfigured() || !supabase) {
      console.log('[DEBUG SUPABASE CREATE STAFF] Supabase client is null or not configured.');
      return { error: 'Supabase service is not connected.' };
    }

    console.log('[DEBUG SUPABASE CREATE STAFF BEFORE] Calling supabase.auth.signUp() with params:', {
      email: email.trim(),
      fullName,
      selectedRole,
    });

    try {
      const response = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: selectedRole,
          },
        },
      });

      const responseStatus = (response as any).status ?? (response.error ? (response.error as any).status : 200);

      console.log('[DEBUG SUPABASE CREATE STAFF AFTER] Response received:', response);
      console.log('[DEBUG SUPABASE CREATE STAFF DETAILS]:', {
        data: response.data,
        error: response.error,
        status: responseStatus,
      });

      const { data, error } = response;

      if (error) {
        console.error('[DEBUG SUPABASE CREATE STAFF ERROR]', error);
        return { error: error.message || String(error) };
      }

      if (data?.user) {
        console.log('[DEBUG SUPABASE CREATE STAFF USER CREATED] User ID:', data.user.id);
        try {
          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email.trim(),
            full_name: fullName,
            role: selectedRole,
          });
          if (profileErr) {
            console.warn('[DEBUG SUPABASE CREATE STAFF PROFILE UPSERT ERROR]', profileErr);
          }
        } catch (pEx) {
          console.warn('[DEBUG SUPABASE CREATE STAFF PROFILE EXCEPTION]', pEx);
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('[DEBUG SUPABASE CREATE STAFF EXCEPTION]', err);
      const exactMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'User creation failed.';
      return { error: exactMsg };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: 'Supabase authentication service is not connected.' };
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
