import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  isLoading: true, // true until we get the initial session
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setIsLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, profile: null })
}));
