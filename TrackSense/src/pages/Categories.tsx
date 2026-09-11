import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Header } from "./Home";
import { api } from "../lib/api";
import { useAppFeedback } from "@/components/AppFeedback";
import { useProfile } from "@/components/ProfileProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UNCATEGORIZED, isUncategorized } from "@/utils/categoryPredict";
import {
    memberOwnerLookup,
    sameCategorySet,
    sortLeafCategories,
    uniqueLeafCategories,
    type CategoryGroup,
} from "@/utils/categoryGroup";

const GROUPS_API = "/api/category-groups";

function namesMatch(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function linkableNames(names: Iterable<string>): string[] {
    return [...names].filter((name) => !isUncategorized(name));
}

export default function Categories() {
    const { reportError, confirm } = useAppFeedback();
    const { canWrite, activeProfileId } = useProfile();
    const { groups, setGroups, expenses, setExpenses, loading } = useWorkspace();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(false);
    const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
    const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
    const [addingCategory, setAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    useEffect(() => {
        setSelectedId(null);
        setEditing(false);
        setError("");
    }, [activeProfileId]);

    useEffect(() => {
        setSelectedId((current) => {
            if (current && groups.some((group) => group.id === current)) return current;
            return groups[0]?.id || null;
        });
    }, [groups]);

    const selected = groups.find((group) => group.id === selectedId) || null;

    useEffect(() => {
        if (!selectedId) {
            setChecked(new Set());
            return;
        }
        const group = groups.find((item) => item.id === selectedId);
        if (!group) return;
        setChecked(new Set(linkableNames(group.categories)));
        setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- do not reset in-progress checkbox edits when groups are saved
    }, [selectedId]);

    const owners = useMemo(() => memberOwnerLookup(groups), [groups]);
    const groupedNames = useMemo(
        () => groups.flatMap((group) => group.categories),
        [groups],
    );
    const leafNames = useMemo(
        () => uniqueLeafCategories(expenses, groupedNames),
        [expenses, groupedNames],
    );
    const sortedLeafNames = useMemo(
        () => sortLeafCategories(leafNames, {
            selectedGroupId: selectedId,
            owners,
        }),
        [leafNames, selectedId, owners],
    );

    const membersDirty = Boolean(selected) && !sameCategorySet(checked, linkableNames(selected?.categories || []));

    async function selectGroup(id: string) {
        if (id === selectedId) return;
        if (!editing && membersDirty) {
            const ok = await confirm({
                title: "Discard unsaved changes?",
                description: "Your unsaved category links will be lost.",
                confirmLabel: "Discard",
                destructive: true,
            });
            if (!ok) return;
        }
        setSelectedId(id);
    }

    function toggleLeaf(name: string, nextChecked: boolean) {
        if (isUncategorized(name)) return;
        const owner = owners.get(name.trim().toLowerCase());
        if (owner && owner.id !== selectedId) return;
        setChecked((current) => {
            const next = new Set(current);
            const match = [...next].find((item) => namesMatch(item, name));
            if (nextChecked) next.add(match || name);
            else if (match) next.delete(match);
            else next.delete(name);
            return next;
        });
    }

    function replaceGroup(saved: CategoryGroup) {
        setGroups((current) =>
            current
                .map((group) => (group.id === saved.id ? saved : group))
                .sort((a, b) => a.name.localeCompare(b.name)),
        );
        if (saved.id === selectedId) {
            setChecked(new Set(linkableNames(saved.categories)));
        }
        setGroupDrafts((current) => ({ ...current, [saved.id]: saved.name }));
    }

    async function enterEdit() {
        if (membersDirty) {
            const ok = await confirm({
                title: "Discard unsaved category links?",
                description: "Your unsaved category links will be lost.",
                confirmLabel: "Discard",
                destructive: true,
            });
            if (!ok) return;
        }
        if (selected) setChecked(new Set(linkableNames(selected.categories)));
        setGroupDrafts(Object.fromEntries(groups.map((group) => [group.id, group.name])));
        setCategoryDrafts(Object.fromEntries(leafNames.map((name) => [name, name])));
        setAddingCategory(false);
        setNewCategoryName("");
        setEditing(true);
        setError("");
    }

    function exitEdit() {
        setEditing(false);
        setAddingCategory(false);
        setNewCategoryName("");
        setError("");
    }

    function cancelLinks() {
        if (!selected) return;
        setChecked(new Set(linkableNames(selected.categories)));
        setError("");
    }

    async function saveLinks() {
        if (!selected) return;
        setSaving(true);
        setError("");
        try {
            const response = await api.put(`${GROUPS_API}/${selected.id}/members`, {
                categories: linkableNames(checked),
            });
            replaceGroup(response.data);
        } catch (err: unknown) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }

    async function createGroup(event: FormEvent) {
        event.preventDefault();
        const name = newGroupName.trim();
        if (!name) return;
        if (!editing && membersDirty) {
            const ok = await confirm({
                title: "Discard unsaved changes?",
                description: "Your unsaved category links will be lost.",
                confirmLabel: "Discard",
                destructive: true,
            });
            if (!ok) return;
        }
        setCreating(true);
        setError("");
        try {
            const response = await api.post(GROUPS_API, { name });
            const created: CategoryGroup = response.data;
            setGroups((current) =>
                [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setSelectedId(created.id);
            setChecked(new Set());
            setGroupDrafts((current) => ({ ...current, [created.id]: created.name }));
            setShowNewGroup(false);
            setNewGroupName("");
        } catch (err: unknown) {
            reportError(err);
        } finally {
            setCreating(false);
        }
    }

    async function renameGroup(id: string) {
        const group = groups.find((item) => item.id === id);
        const name = (groupDrafts[id] || "").trim();
        if (!group || !name || name === group.name) {
            if (group) setGroupDrafts((current) => ({ ...current, [id]: group.name }));
            return;
        }
        setSaving(true);
        setError("");
        try {
            const response = await api.patch(`${GROUPS_API}/${id}`, { name });
            replaceGroup(response.data);
        } catch (err: unknown) {
            reportError(err);
            setGroupDrafts((current) => ({ ...current, [id]: group.name }));
        } finally {
            setSaving(false);
        }
    }

    async function deleteGroup(id: string) {
        const group = groups.find((item) => item.id === id);
        if (!group) return;
        const ok = await confirm({
            title: `Delete group ${group.name}?`,
            description: "Categories stay; they are just unlinked.",
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok) return;
        setSaving(true);
        setError("");
        try {
            await api.delete(`${GROUPS_API}/${id}`);
            const remaining = groups.filter((item) => item.id !== id);
            setGroups(remaining);
            setGroupDrafts((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
            if (selectedId === id) {
                setSelectedId(remaining[0]?.id || null);
            }
        } catch (err: unknown) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }

    async function renameCategory(original: string) {
        const nextName = (categoryDrafts[original] || "").trim();
        if (!nextName || namesMatch(original, nextName)) {
            setCategoryDrafts((current) => ({ ...current, [original]: original }));
            return;
        }
        setSaving(true);
        setError("");
        try {
            await api.patch(`${GROUPS_API}/leaf`, { from: original, to: nextName });
            setExpenses((current) =>
                current.map((expense) =>
                    namesMatch(expense.category, original) ? { ...expense, category: nextName } : expense
                ),
            );
            setGroups((current) =>
                current.map((group) => ({
                    ...group,
                    categories: group.categories.map((name) =>
                        namesMatch(name, original) ? nextName : name
                    ),
                })),
            );
            setChecked((current) => {
                const next = new Set<string>();
                for (const name of current) {
                    next.add(namesMatch(name, original) ? nextName : name);
                }
                return next;
            });
            setCategoryDrafts((current) => {
                const next = { ...current };
                delete next[original];
                next[nextName] = nextName;
                return next;
            });
        } catch (err: unknown) {
            reportError(err);
            setCategoryDrafts((current) => ({ ...current, [original]: original }));
        } finally {
            setSaving(false);
        }
    }

    async function deleteCategory(name: string) {
        if (namesMatch(name, UNCATEGORIZED)) return;
        const ok = await confirm({
            title: `Delete category ${name}?`,
            description: `Expenses in ${name} will be set to Uncategorized.`,
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok) return;
        setSaving(true);
        setError("");
        try {
            await api.delete(`${GROUPS_API}/leaf`, { data: { name } });
            setExpenses((current) =>
                current.map((expense) =>
                    namesMatch(expense.category, name) ? { ...expense, category: UNCATEGORIZED } : expense
                ),
            );
            setGroups((current) =>
                current.map((group) => ({
                    ...group,
                    categories: group.categories.filter((item) => !namesMatch(item, name)),
                })),
            );
            setChecked((current) => new Set([...current].filter((item) => !namesMatch(item, name))));
            setCategoryDrafts((current) => {
                const next = { ...current };
                delete next[name];
                return next;
            });
        } catch (err: unknown) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }

    async function startAddCategory() {
        if (!selectedId) {
            setError("Create or select a category group first.");
            return;
        }
        if (!editing) {
            if (membersDirty) {
                const ok = await confirm({
                    title: "Discard unsaved category links?",
                    description: "Your unsaved category links will be lost.",
                    confirmLabel: "Discard",
                    destructive: true,
                });
                if (!ok) return;
            }
            if (selected) setChecked(new Set(linkableNames(selected.categories)));
            setGroupDrafts(Object.fromEntries(groups.map((group) => [group.id, group.name])));
            setCategoryDrafts(Object.fromEntries(leafNames.map((name) => [name, name])));
            setEditing(true);
        }
        setAddingCategory(true);
        setNewCategoryName("");
        setError("");
    }

    async function submitNewCategory() {
        const name = newCategoryName.trim();
        if (!name) {
            setAddingCategory(false);
            return;
        }
        if (isUncategorized(name)) {
            setError("Uncategorized cannot be linked to a group.");
            return;
        }
        if (!selectedId) {
            setError("Create or select a category group first.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const response = await api.post(`${GROUPS_API}/${selectedId}/members`, { category: name });
            replaceGroup(response.data);
            setCategoryDrafts((current) => ({ ...current, [name]: name }));
            setAddingCategory(false);
            setNewCategoryName("");
        } catch (err: unknown) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="space-y-6 px-8 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tight">Category groups</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Group leaf categories like Rent and Wifi under Housing, or Flights under Vacation.
                        </p>
                    </div>
                    {canWrite ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => { setNewGroupName(""); setShowNewGroup(true); }}>
                            New group
                        </Button>
                        <Button type="button" variant="outline" onClick={startAddCategory}>
                            <Plus />
                            Add category
                        </Button>
                        {editing ? (
                            <Button type="button" onClick={exitEdit} disabled={saving}>Done</Button>
                        ) : (
                            <Button type="button" variant="outline" onClick={enterEdit}>
                                <Pencil />
                                Edit
                            </Button>
                        )}
                    </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">View only</p>
                    )}
                </div>

                {error ? (
                    <p className="text-sm text-destructive" role="alert">{error}</p>
                ) : null}

                {loading ? (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                        role="status"
                        aria-live="polite"
                    >
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                        <p className="text-sm text-muted-foreground">Loading your category groups...</p>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
                        <aside className="rounded-xl border bg-card p-3">
                            {groups.length === 0 ? (
                                <p className="px-2 py-6 text-sm text-muted-foreground">
                                    No category groups yet.
                                </p>
                            ) : (
                                <ul className="space-y-1">
                                    {groups.map((group) => (
                                        <li key={group.id}>
                                            {editing ? (
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-1 rounded-md px-1 py-1",
                                                        group.id === selectedId && "bg-accent",
                                                    )}
                                                >
                                                    <Input
                                                        aria-label={`Rename ${group.name}`}
                                                        value={groupDrafts[group.id] ?? group.name}
                                                        onFocus={() => setSelectedId(group.id)}
                                                        onChange={(event) =>
                                                            setGroupDrafts((current) => ({
                                                                ...current,
                                                                [group.id]: event.target.value,
                                                            }))
                                                        }
                                                        onBlur={() => renameGroup(group.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === "Enter") {
                                                                event.currentTarget.blur();
                                                            }
                                                        }}
                                                        maxLength={80}
                                                        className="h-8"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        aria-label={`Delete group ${group.name}`}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => deleteGroup(group.id)}
                                                        disabled={saving}
                                                    >
                                                        <X />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                                                        group.id === selectedId && "bg-accent font-medium",
                                                    )}
                                                    onClick={() => selectGroup(group.id)}
                                                >
                                                    <span className="block truncate">{group.name}</span>
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        {group.categories.length === 1
                                                            ? "1 category"
                                                            : `${group.categories.length} categories`}
                                                    </span>
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </aside>

                        <section className="rounded-xl border bg-card p-6">
                            {!selected ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    Create a category group to start linking categories.
                                </p>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold tracking-tight">{selected.name}</h2>
                                        {!editing && canWrite &&
                                            <div className="flex items-center gap-2">
                                                {membersDirty &&
                                                    <Button type="button" variant="outline" onClick={cancelLinks} disabled={saving}>
                                                        Cancel
                                                    </Button>
                                                }
                                                <Button type="button" onClick={saveLinks} disabled={!membersDirty || saving}>
                                                    {saving ? "Saving..." : "Save"}
                                                </Button>
                                            </div>
                                        }
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium">
                                            {editing ? "Categories" : "Link categories"}
                                        </h3>
                                        {sortedLeafNames.length === 0 && !addingCategory ? (
                                            <p className="text-sm text-muted-foreground">
                                                Add a category, or add expenses with categories, then link them here.
                                            </p>
                                        ) : (
                                            <ul className="grid max-h-[28rem] grid-flow-col auto-cols-[18rem] grid-rows-[repeat(10,auto)] gap-x-6 gap-y-1 overflow-x-auto overflow-y-hidden pb-2">
                                                {editing && addingCategory ? (
                                                    <li className="flex min-w-0 items-center gap-1 px-1 py-1">
                                                        <Input
                                                            aria-label="New category name"
                                                            value={newCategoryName}
                                                            onChange={(event) => setNewCategoryName(event.target.value)}
                                                            onBlur={() => {
                                                                if (!newCategoryName.trim()) setAddingCategory(false);
                                                                else void submitNewCategory();
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setAddingCategory(false);
                                                                    setNewCategoryName("");
                                                                }
                                                            }}
                                                            placeholder="Category name"
                                                            maxLength={200}
                                                            className="h-8 min-w-0"
                                                            autoFocus
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            aria-label="Cancel new category"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setAddingCategory(false);
                                                                setNewCategoryName("");
                                                            }}
                                                        >
                                                            <X />
                                                        </Button>
                                                    </li>
                                                ) : null}
                                                {sortedLeafNames.map((name) => {
                                                    const owner = owners.get(name.trim().toLowerCase());
                                                    const elsewhere = Boolean(owner && owner.id !== selectedId);
                                                    const unlinkable = elsewhere || isUncategorized(name);
                                                    const isChecked = !isUncategorized(name)
                                                        && [...checked].some((item) => namesMatch(item, name));
                                                    const checkboxId = `leaf-${name}`;
                                                    if (editing) {
                                                        return (
                                                            <li key={name} className="flex min-w-0 items-center gap-1 px-1 py-1">
                                                                <Input
                                                                    aria-label={`Rename ${name}`}
                                                                    value={categoryDrafts[name] ?? name}
                                                                    onChange={(event) =>
                                                                        setCategoryDrafts((current) => ({
                                                                            ...current,
                                                                            [name]: event.target.value,
                                                                        }))
                                                                    }
                                                                    onBlur={() => renameCategory(name)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    maxLength={200}
                                                                    className="h-8 min-w-0"
                                                                />
                                                                {namesMatch(name, UNCATEGORIZED) ? (
                                                                    <span className="w-6 shrink-0" />
                                                                ) : (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon-xs"
                                                                        aria-label={`Delete category ${name}`}
                                                                        onMouseDown={(event) => event.preventDefault()}
                                                                        onClick={() => deleteCategory(name)}
                                                                        disabled={saving}
                                                                    >
                                                                        <X />
                                                                    </Button>
                                                                )}
                                                            </li>
                                                        );
                                                    }
                                                    return (
                                                        <li key={name} className="min-w-0">
                                                            <label
                                                                className={cn(
                                                                    "flex h-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60",
                                                                    unlinkable && "cursor-not-allowed opacity-60",
                                                                )}
                                                            >
                                                                <Checkbox
                                                                    id={checkboxId}
                                                                    checked={isChecked}
                                                                    disabled={unlinkable || !canWrite}
                                                                    onCheckedChange={(value) =>
                                                                        toggleLeaf(name, value === true)
                                                                    }
                                                                />
                                                                <span className="min-w-0 flex-1 truncate">{name}</span>
                                                                {elsewhere ? (
                                                                    <span className="shrink-0 text-xs text-muted-foreground">
                                                                        In {owner?.name}
                                                                    </span>
                                                                ) : isUncategorized(name) ? (
                                                                    <span className="shrink-0 text-xs text-muted-foreground">
                                                                        Cannot be grouped
                                                                    </span>
                                                                ) : null}
                                                            </label>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>

            <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
                <DialogContent>
                    <form onSubmit={createGroup}>
                        <DialogHeader>
                            <DialogTitle>New category group</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            <Label htmlFor="new-group-name">Name</Label>
                            <Input
                                id="new-group-name"
                                value={newGroupName}
                                onChange={(event) => setNewGroupName(event.target.value)}
                                placeholder="Housing"
                                maxLength={80}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowNewGroup(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!newGroupName.trim() || creating}>
                                {creating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
