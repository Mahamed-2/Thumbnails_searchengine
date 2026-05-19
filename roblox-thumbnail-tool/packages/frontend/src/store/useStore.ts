// =============================================================================
// src/store/useStore.ts — Global UI State
// =============================================================================

import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Example for dark mode if we add a toggle later
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  theme: 'dark', // Defaulting to dark as per design system
  setTheme: (theme) => set({ theme }),
}));
