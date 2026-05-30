import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './lib/store';

const AuthWrapper = ({ children }) => {
  const { setUser, setProfile, clearAuth, setIsLoading } = useAuthStore();
  const [isInitializing, setLocalIsInitializing] = useState(true);

  const finishInit = () => {
    setLocalIsInitializing(false);
    setIsLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    let isInitialFired = false;

    const syncProfile = async (user) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error || !data) {
          console.warn("No profile found for authenticated user. Wiping ghost session...");
          supabase.auth.signOut();
          if (isMounted) clearAuth();
        } else {
          if (isMounted) {
            setUser(user);
            setProfile(data);
          }
        }
      } catch (err) {
        console.error("Error syncing profile:", err);
        supabase.auth.signOut();
        if (isMounted) clearAuth();
      } finally {
        if (isMounted && !isInitialFired) {
          finishInit();
          isInitialFired = true;
        }
      }
    };

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await syncProfile(session.user);
        } else {
          if (isMounted) {
            clearAuth();
            finishInit();
            isInitialFired = true;
          }
        }
      } catch (e) {
        console.error("Initialization error:", e);
        if (isMounted) {
          finishInit();
          isInitialFired = true;
        }
      }
    };

    const failsafeTimeout = setTimeout(() => {
      if (isMounted && !isInitialFired) {
        console.warn("Failsafe: Auth initialization timed out. Forcing load.");
        finishInit();
        isInitialFired = true;
      }
    }, 2500);

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (isMounted) {
          clearAuth();
          if (!isInitialFired) {
            finishInit();
            isInitialFired = true;
          }
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Only sync on token refresh (silent session renewal).
        // SIGNED_IN is handled directly in Auth.jsx's handleSignIn,
        // which sets user+profile then navigates — no race condition.
        await syncProfile(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(failsafeTimeout);
    };
  }, [setUser, setProfile, clearAuth, setIsLoading]);

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-indigo-600 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="font-bold animate-pulse">Initializing Application...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default AuthWrapper;
