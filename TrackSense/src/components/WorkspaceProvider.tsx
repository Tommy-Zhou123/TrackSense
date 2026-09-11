import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAppFeedback } from "@/components/AppFeedback";
import { useProfile } from "@/components/ProfileProvider";
import type { Expense } from "@/types/expense";
import { mapExpense } from "@/types/expense";
import type { ProfileMember } from "@/types/profile";
import type { CategoryGroup } from "@/utils/categoryGroup";
import type { VendorRule } from "@/utils/categoryPredict";

interface WorkspaceContextValue {
  expenses: Expense[];
  groups: CategoryGroup[];
  members: ProfileMember[];
  vendorRules: VendorRule[];
  loading: boolean;
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setGroups: Dispatch<SetStateAction<CategoryGroup[]>>;
  setMembers: Dispatch<SetStateAction<ProfileMember[]>>;
  setVendorRules: Dispatch<SetStateAction<VendorRule[]>>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { reportError } = useAppFeedback();
  const { activeProfileId } = useProfile();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [members, setMembers] = useState<ProfileMember[]>([]);
  const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (profileId: string) => {
      const [expenseResponse, groupResponse, memberResponse, ruleResponse] = await Promise.all([
        api.get("/api/expenses"),
        api.get("/api/category-groups").catch(() => ({ data: { groups: [] } })),
        api.get(`/api/profiles/${profileId}/members`).catch(() => ({ data: { members: [] } })),
        api.get("/api/vendor-rules").catch(() => ({ data: { rules: [] } })),
      ]);
      const nextExpenses: Expense[] = (expenseResponse.data.expenses || [])
        .map(mapExpense)
        .sort((a: Expense, b: Expense) => b.date.getTime() - a.date.getTime());
      return {
        expenses: nextExpenses,
        groups: (groupResponse.data.groups || []) as CategoryGroup[],
        members: (memberResponse.data.members || []) as ProfileMember[],
        vendorRules: (ruleResponse.data.rules || []) as VendorRule[],
      };
    },
    [],
  );

  useEffect(() => {
    if (!activeProfileId) {
      setExpenses([]);
      setGroups([]);
      setMembers([]);
      setVendorRules([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    load(activeProfileId)
      .then((next) => {
        if (cancelled) return;
        setExpenses(next.expenses);
        setGroups(next.groups);
        setMembers(next.members);
        setVendorRules(next.vendorRules);
      })
      .catch((err) => {
        if (cancelled) return;
        setExpenses([]);
        setGroups([]);
        setMembers([]);
        setVendorRules([]);
        if (err?.response?.data?.message === "Not Logged In" || err?.response?.status === 401) {
          navigate("/login");
        } else {
          reportError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, load, navigate, reportError]);

  const refreshWorkspace = useCallback(async () => {
    if (!activeProfileId) return;
    const next = await load(activeProfileId);
    setExpenses(next.expenses);
    setGroups(next.groups);
    setMembers(next.members);
    setVendorRules(next.vendorRules);
  }, [activeProfileId, load]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      expenses,
      groups,
      members,
      vendorRules,
      loading,
      setExpenses,
      setGroups,
      setMembers,
      setVendorRules,
      refreshWorkspace,
    }),
    [expenses, groups, members, vendorRules, loading, refreshWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
