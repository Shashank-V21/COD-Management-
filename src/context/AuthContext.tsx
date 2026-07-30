import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  isCloudConnected: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: string | null }>;
  signUp: (email: string, pass: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: 'Staff',
  loading: true,
  isCloudConnected: false,
  signIn: async () => ({ error: 'Auth not initialized' }),
  signUp: async () => ({ error: 'Auth not initialized' }),
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('Admin'); // Default for local demo
  const [loading, setLoading] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsCloudConnected(configured);

    if (!configured || !supabase) {
      // Local fallback session
      const savedUser = localStorage.getItem('cod_auth_demo_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          setProfile(parsed);
          setRole(parsed.role || 'Admin');
        } catch {}
      } else {
        // Default demo session
        const demoProfile: UserProfile = {
          id: 'demo_user_1',
          email: 'admin@logistics.com',
          role: 'Admin',
          fullName: 'Hub Admin Manager',
        };
        setUser(demoProfile);
        setProfile(demoProfile);
        setRole('Admin');
      }
      setLoading(false);
      return;
    }

    // Supabase Auth session listener
    const initAuth = async () => {
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
        console.error('Error fetching Supabase auth session:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

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
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
      }

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
      console.error('Failed to fetch user profile:', err);
    }
  };

  const signIn = async (email: string, pass: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local fallback sign in
      const roleToUse: UserRole = email.toLowerCase().includes('staff') ? 'Staff' : 'Admin';
      const demoProf: UserProfile = {
        id: `demo_${Date.now()}`,
        email,
        role: roleToUse,
        fullName: email.split('@')[0],
      };
      localStorage.setItem('cod_auth_demo_user', JSON.stringify(demoProf));
      setUser(demoProf);
      setProfile(demoProf);
      setRole(roleToUse);
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
      return { error: err?.message || 'Login failed' };
    }
  };

  const signUp = async (email: string, pass: string, fullName: string, selectedRole: UserRole) => {
    if (!isSupabaseConfigured() || !supabase) {
      // Local fallback sign up
      const demoProf: UserProfile = {
        id: `demo_${Date.now()}`,
        email,
        role: selectedRole,
        fullName,
      };
      localStorage.setItem('cod_auth_demo_user', JSON.stringify(demoProf));
      setUser(demoProf);
      setProfile(demoProf);
      setRole(selectedRole);
      return { error: null };
    }

    try {
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
        // Create user profile directly
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: selectedRole,
        });
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed' };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('cod_auth_demo_user');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        isCloudConnected,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
