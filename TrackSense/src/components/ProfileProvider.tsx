import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";
import type { ProfileSummary } from "../types/profile";

interface ProfileContextValue {
  profiles: ProfileSummary[];
  activeProfile: ProfileSummary | null;
  activeProfileId: string | null;
  loading: boolean;
  canWrite: boolean;
  isOwner: boolean;
  setActiveProfileId: (id: string) => void;
  refreshProfiles: (preferId?: string) => Promise<ProfileSummary[]>;
  createProfile: (name: string) => Promise<ProfileSummary>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function storageKey(userId: string) {
  return `tracksense.activeProfile.${userId}`;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeProfileIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId ?? null;

  useEffect(() => {
    const interceptor = api.interceptors.request.use((config) => {
      const id = activeProfileIdRef.current;
      if (id) {
        config.headers["X-Profile-Id"] = id;
      }
      return config;
    });
    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, []);

  const applyActive = useCallback((id: string | null) => {
    activeProfileIdRef.current = id;
    setActiveProfileIdState(id);
    const uid = userIdRef.current;
    if (uid && id) {
      localStorage.setItem(storageKey(uid), id);
    }
  }, []);

  const refreshProfiles = useCallback(
    async (preferId?: string) => {
      const response = await api.get("/api/profiles");
      const next: ProfileSummary[] = response.data.profiles || [];
      setProfiles(next);
      const stored = userIdRef.current
        ? localStorage.getItem(storageKey(userIdRef.current))
        : null;
      const chosen =
        next.find((profile) => profile.id === preferId) ||
        next.find((profile) => profile.id === activeProfileIdRef.current) ||
        next.find((profile) => profile.id === stored) ||
        next[0];
      applyActive(chosen?.id || null);
      return next;
    },
    [applyActive],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      setProfiles([]);
      applyActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshProfiles()
      .catch(() => {
        setProfiles([]);
        applyActive(null);
      })
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, userId, refreshProfiles, applyActive]);

  const setActiveProfileId = useCallback(
    (id: string) => {
      if (!id) return;
      applyActive(id);
    },
    [applyActive],
  );

  const createProfile = useCallback(
    async (name: string) => {
      const response = await api.post("/api/profiles", { name });
      const created: ProfileSummary = response.data;
      await refreshProfiles(created.id);
      return created;
    },
    [refreshProfiles],
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || null,
    [profiles, activeProfileId],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles,
      activeProfile,
      activeProfileId,
      loading,
      canWrite: activeProfile?.role !== "viewer",
      isOwner: activeProfile?.role === "owner",
      setActiveProfileId,
      refreshProfiles,
      createProfile,
    }),
    [
      profiles,
      activeProfile,
      activeProfileId,
      loading,
      setActiveProfileId,
      refreshProfiles,
      createProfile,
    ],
  );

  if (!isLoaded || (isSignedIn && loading)) {
    return null;
  }

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
