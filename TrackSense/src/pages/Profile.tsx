import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Header } from "./Home";
import { api } from "../lib/api";
import { useAppFeedback } from "@/components/AppFeedback";
import { useProfile } from "@/components/ProfileProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProfileMember, ProfileRole, ProfileSummary } from "@/types/profile";
import { activePeople, defaultSplitPercents } from "@/utils/expenseAttribution";

function memberLabel(member: ProfileMember, selfId?: string) {
    if (member.id === selfId) {
        return member.email.endsWith("@clerk.local") ? "You" : `${member.email} (you)`;
    }
    return member.email;
}

export default function Profile() {
    const { reportError, showSuccess, confirm } = useAppFeedback();
    const {
        profiles,
        activeProfile,
        isOwner,
        setActiveProfileId,
        refreshProfiles,
        createProfile,
    } = useProfile();
    const { members, setMembers, loading } = useWorkspace();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(false);
    const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
    const [showNewProfile, setShowNewProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");
    const [creating, setCreating] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"member" | "viewer">("member");
    const [inviting, setInviting] = useState(false);
    const [splitDrafts, setSplitDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        setEditing(false);
        setInviteEmail("");
        setError("");
    }, [activeProfile?.id]);

    const myMember = members.find((member) => member.id === activeProfile?.memberId);
    const splitMembers = activePeople(members);

    function splitDraftsFrom(list: ProfileMember[]) {
        const people = activePeople(list);
        const sum = people.reduce((total, member) => total + Number(member.splitPercent || 0), 0);
        const defaults = defaultSplitPercents(people.length);
        return Object.fromEntries(
            people.map((member, index) => [
                member.id,
                String(sum > 0 ? member.splitPercent : (defaults[index] ?? 0)),
            ]),
        );
    }

    function enterEdit() {
        setNameDrafts(Object.fromEntries(profiles.map((profile) => [profile.id, profile.name])));
        setSplitDrafts(splitDraftsFrom(members));
        setEditing(true);
        setError("");
    }

    function exitEdit() {
        setEditing(false);
        setError("");
    }

    function applyEvenSplitDrafts() {
        const defaults = defaultSplitPercents(splitMembers.length);
        setSplitDrafts(Object.fromEntries(
            splitMembers.map((member, index) => [member.id, String(defaults[index] ?? 0)]),
        ));
        setError("");
    }

    async function saveSplitPercents() {
        if (!activeProfile || !isOwner) return true;
        const shares = splitMembers.map((member) => ({
            memberId: member.id,
            percent: Number(splitDrafts[member.id]),
        }));
        if (shares.length === 0) return true;
        if (shares.some((share) => !Number.isFinite(share.percent) || share.percent < 0 || share.percent > 100)) {
            setError("Split percents must be between 0 and 100.");
            return false;
        }
        const total = shares.reduce((sum, share) => sum + share.percent, 0);
        if (Math.abs(total - 100) > 0.05) {
            setError(`Split percents must add up to 100% (currently ${total.toFixed(2)}%).`);
            return false;
        }
        setSaving(true);
        try {
            const response = await api.put(`/api/profiles/${activeProfile.id}/split`, { shares });
            setMembers(response.data.members || members);
            return true;
        } catch (err) {
            reportError(err);
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function finishEdit() {
        const saved = await saveSplitPercents();
        if (!saved) return;
        exitEdit();
    }

    async function selectProfile(id: string) {
        if (id === activeProfile?.id) return;
        setActiveProfileId(id);
    }

    async function createNewProfile(event: FormEvent) {
        event.preventDefault();
        const name = newProfileName.trim();
        if (!name) return;
        setCreating(true);
        setError("");
        try {
            const created = await createProfile(name);
            setNameDrafts((current) => ({ ...current, [created.id]: created.name }));
            setShowNewProfile(false);
            setNewProfileName("");
            showSuccess("Profile created.");
        } catch (err) {
            reportError(err);
        } finally {
            setCreating(false);
        }
    }

    async function renameProfile(id: string) {
        const profile = profiles.find((item) => item.id === id);
        const name = (nameDrafts[id] || "").trim();
        if (!profile || profile.role !== "owner") {
            if (profile) setNameDrafts((current) => ({ ...current, [id]: profile.name }));
            return;
        }
        if (!name || name === profile.name) {
            setNameDrafts((current) => ({ ...current, [id]: profile.name }));
            return;
        }
        setSaving(true);
        setError("");
        try {
            await api.patch(`/api/profiles/${id}`, { name });
            await refreshProfiles(id);
            setNameDrafts((current) => ({ ...current, [id]: name }));
        } catch (err) {
            reportError(err);
            setNameDrafts((current) => ({ ...current, [id]: profile.name }));
        } finally {
            setSaving(false);
        }
    }

    async function deleteOwnedProfile(profile: ProfileSummary) {
        if (profile.role !== "owner") return;
        const ok = await confirm({
            title: `Delete profile ${profile.name}?`,
            description: "All expenses, vendor rules, and category groups on this profile will be deleted. This cannot be undone.",
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok) return;
        setSaving(true);
        setError("");
        try {
            await api.delete(`/api/profiles/${profile.id}`);
            await refreshProfiles();
            showSuccess("Profile deleted.");
        } catch (err) {
            reportError(err);
        } finally {
            setSaving(false);
        }
    }

    async function sendInvite(event: FormEvent) {
        event.preventDefault();
        if (!activeProfile || !isOwner) return;
        const email = inviteEmail.trim();
        if (!email) return;
        setInviting(true);
        setError("");
        try {
            const response = await api.post(`/api/profiles/${activeProfile.id}/invites`, {
                email,
                role: inviteRole,
            });
            setMembers((current) => [...current, response.data.member]);
            if (editing && response.data.member?.status === "active") {
                setSplitDrafts((current) => ({
                    ...current,
                    [response.data.member.id]: String(response.data.member.splitPercent ?? 0),
                }));
            }
            setInviteEmail("");
            showSuccess(
                response.data.invited
                    ? `Invite sent to ${email}. They can register to join.`
                    : `${email} was added to this profile.`,
            );
        } catch (err) {
            reportError(err);
        } finally {
            setInviting(false);
        }
    }

    async function changeRole(member: ProfileMember, role: ProfileRole) {
        if (!activeProfile || member.role === "owner" || role === "owner") return;
        try {
            const response = await api.patch(
                `/api/profiles/${activeProfile.id}/members/${member.id}`,
                { role },
            );
            setMembers((current) =>
                current.map((item) => (item.id === member.id ? response.data : item)),
            );
        } catch (err) {
            reportError(err);
        }
    }

    async function removeMember(member: ProfileMember, leaving: boolean) {
        if (!activeProfile) return;
        const ok = await confirm({
            title: leaving ? "Leave this profile?" : member.status === "invited" ? "Revoke this invite?" : "Remove this person?",
            description: leaving
                ? "You will lose access to this profile's expenses until you are invited again."
                : `${member.email} will lose access to this profile.`,
            confirmLabel: leaving ? "Leave" : member.status === "invited" ? "Revoke" : "Remove",
            destructive: true,
        });
        if (!ok) return;
        try {
            await api.delete(`/api/profiles/${activeProfile.id}/members/${member.id}`);
            if (leaving) {
                await refreshProfiles();
                showSuccess("You left the profile.");
            } else {
                setMembers((current) => current.filter((item) => item.id !== member.id));
                showSuccess(member.status === "invited" ? "Invite revoked." : "Member removed.");
            }
        } catch (err) {
            reportError(err);
        }
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="space-y-6 px-8 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tight">Profiles</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Each profile has its own expenses and can be shared with other people.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => { setNewProfileName(""); setShowNewProfile(true); }}>
                            <Plus />
                            Add
                        </Button>
                        {editing ? (
                            <Button type="button" onClick={finishEdit} disabled={saving}>Done</Button>
                        ) : (
                            <Button type="button" variant="outline" onClick={enterEdit}>
                                <Pencil />
                                Edit
                            </Button>
                        )}
                    </div>
                </div>

                {error ? (
                    <p className="text-sm text-destructive" role="alert">{error}</p>
                ) : null}

                {loading && !activeProfile ? (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                        role="status"
                        aria-live="polite"
                    >
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                        <p className="text-sm text-muted-foreground">Loading your profiles...</p>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]">
                        <aside className="rounded-xl border bg-card p-3">
                            {profiles.length === 0 ? (
                                <p className="px-2 py-6 text-sm text-muted-foreground">
                                    No profiles yet.
                                </p>
                            ) : (
                                <ul className="space-y-1">
                                    {profiles.map((profile) => (
                                        <li key={profile.id}>
                                            {editing && profile.role === "owner" ? (
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-1 rounded-md px-1 py-1",
                                                        profile.id === activeProfile?.id && "bg-accent",
                                                    )}
                                                >
                                                    <Input
                                                        aria-label={`Rename ${profile.name}`}
                                                        value={nameDrafts[profile.id] ?? profile.name}
                                                        onFocus={() => selectProfile(profile.id)}
                                                        onChange={(event) =>
                                                            setNameDrafts((current) => ({
                                                                ...current,
                                                                [profile.id]: event.target.value,
                                                            }))
                                                        }
                                                        onBlur={() => renameProfile(profile.id)}
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
                                                        aria-label={`Delete profile ${profile.name}`}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => deleteOwnedProfile(profile)}
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
                                                        profile.id === activeProfile?.id && "bg-accent font-medium",
                                                    )}
                                                    onClick={() => selectProfile(profile.id)}
                                                >
                                                    <span className="block truncate">{profile.name}</span>
                                                    <span className="text-xs font-normal text-muted-foreground capitalize">
                                                        {profile.role}
                                                    </span>
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </aside>

                        <section className="rounded-xl border bg-card p-6">
                            {!activeProfile ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    Create a profile to start sharing expenses.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-semibold tracking-tight">Invite</h2>
                                    {isOwner ? (
                                        <form className="space-y-4" onSubmit={sendInvite}>
                                            <div className="space-y-2">
                                                <Label htmlFor="invite-email">Email</Label>
                                                <Input
                                                    id="invite-email"
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={(event) => setInviteEmail(event.target.value)}
                                                    placeholder="name@example.com"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="invite-role">Role</Label>
                                                <Select
                                                    value={inviteRole}
                                                    onValueChange={(value) => setInviteRole(value as "member" | "viewer")}
                                                >
                                                    <SelectTrigger id="invite-role">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="member">Member</SelectItem>
                                                        <SelectItem value="viewer">Viewer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                                                {inviting ? "Sending..." : "Invite"}
                                            </Button>
                                        </form>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Only the owner can invite people to {activeProfile.name}.
                                        </p>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="rounded-xl border bg-card p-6">
                            {!activeProfile ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    Select a profile to see who has access.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-semibold tracking-tight">Roles</h2>
                                    {loading ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                            Loading people...
                                        </div>
                                    ) : members.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No one is on this profile yet.</p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {members.map((member) => {
                                                const canManage = editing && isOwner && member.role !== "owner";
                                                const canLeave = editing && !isOwner && member.id === myMember?.id;
                                                return (
                                                    <li
                                                        key={member.id}
                                                        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm">
                                                                {memberLabel(member, activeProfile.memberId)}
                                                            </p>
                                                            {!editing || member.role === "owner" ? (
                                                                <p className="text-xs capitalize text-muted-foreground">
                                                                    {member.role}
                                                                    {member.status === "invited" ? " · pending" : ""}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        {member.status === "invited" && !canManage ? (
                                                            <Badge variant="outline">Pending</Badge>
                                                        ) : null}
                                                        {canManage ? (
                                                            <>
                                                                <Select
                                                                    value={member.role}
                                                                    onValueChange={(value) => changeRole(member, value as ProfileRole)}
                                                                >
                                                                    <SelectTrigger className="h-8 w-[7.5rem]" size="sm">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="member">Member</SelectItem>
                                                                        <SelectItem value="viewer">Viewer</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-xs"
                                                                    aria-label={member.status === "invited" ? `Revoke ${member.email}` : `Remove ${member.email}`}
                                                                    onClick={() => removeMember(member, false)}
                                                                >
                                                                    <X />
                                                                </Button>
                                                            </>
                                                        ) : canLeave ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                aria-label="Leave profile"
                                                                onClick={() => removeMember(member, true)}
                                                            >
                                                                <X />
                                                            </Button>
                                                        ) : null}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    {splitMembers.length > 0 ? (
                                        <div className="space-y-3 border-t pt-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-sm font-medium">Default split</h3>
                                                {editing && isOwner ? (
                                                    <Button type="button" variant="outline" size="xs" onClick={applyEvenSplitDrafts}>
                                                        Even split
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Unassigned expenses are divided by these percents. Default is 100% / {splitMembers.length} {splitMembers.length === 1 ? "person" : "people"}.
                                            </p>
                                            <ul className="space-y-1">
                                                {splitMembers.map((member) => (
                                                    <li key={`split-${member.id}`} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
                                                        <p className="min-w-0 flex-1 truncate text-sm">
                                                            {memberLabel(member, activeProfile.memberId)}
                                                        </p>
                                                        {editing && isOwner ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    aria-label={`Split percent for ${member.email}`}
                                                                    className="h-8 w-20 text-right"
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    step={0.001}
                                                                    value={splitDrafts[member.id] ?? String(member.splitPercent ?? 0)}
                                                                    onChange={(event) =>
                                                                        setSplitDrafts((current) => ({
                                                                            ...current,
                                                                            [member.id]: event.target.value,
                                                                        }))
                                                                    }
                                                                />
                                                                <span className="text-sm text-muted-foreground">%</span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm tabular-nums text-muted-foreground">
                                                                {Number(member.splitPercent || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}%
                                                            </p>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                            {editing && isOwner ? (
                                                <p className={cn(
                                                    "text-xs tabular-nums",
                                                    Math.abs(splitMembers.reduce((sum, member) => sum + Number(splitDrafts[member.id] ?? member.splitPercent), 0) - 100) > 0.05
                                                        ? "text-destructive"
                                                        : "text-muted-foreground",
                                                )}>
                                                    Total {splitMembers.reduce((sum, member) => sum + Number(splitDrafts[member.id] ?? member.splitPercent), 0).toFixed(3)}%
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>

            <Dialog open={showNewProfile} onOpenChange={setShowNewProfile}>
                <DialogContent>
                    <form onSubmit={createNewProfile}>
                        <DialogHeader>
                            <DialogTitle>New profile</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            <Label htmlFor="new-profile-name">Name</Label>
                            <Input
                                id="new-profile-name"
                                value={newProfileName}
                                onChange={(event) => setNewProfileName(event.target.value)}
                                placeholder="Family, Business, ..."
                                maxLength={80}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowNewProfile(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!newProfileName.trim() || creating}>
                                {creating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
