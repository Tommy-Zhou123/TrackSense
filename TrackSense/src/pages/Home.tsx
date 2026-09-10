import { useLocation, useNavigate } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { useState, type FormEvent } from "react";
import { Plus, Settings } from "lucide-react";
import ShimmerText from "@/components/kokonutui/shimmer-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
import { useProfile } from "@/components/ProfileProvider";
import { useAppFeedback } from "@/components/AppFeedback";

export const Header = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { profiles, activeProfile, setActiveProfileId, createProfile } = useProfile();
    const { reportError } = useAppFeedback();
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const navButtonClass = (path: string) =>
        cn(
            "text-white hover:bg-white/10 hover:text-white",
            pathname === path && "bg-white/15",
        );

    async function handleCreate(event: FormEvent) {
        event.preventDefault();
        const name = newName.trim();
        if (!name) return;
        setCreating(true);
        try {
            await createProfile(name);
            setShowCreate(false);
            setNewName("");
        } catch (err) {
            reportError(err);
        } finally {
            setCreating(false);
        }
    }

    return (
        <>
            <header className="flex items-center gap-6 bg-black px-8 py-4 text-white">
                <ShimmerText className="text-2xl from-white via-neutral-400 to-white" text="TrackSense" wrapperClassName="p-0" />
                <nav className="flex items-center gap-2 text-sm">
                    <Button className={navButtonClass("/expenses")} variant="ghost" onClick={() => navigate("/expenses")}>
                        Expenses
                    </Button>
                    <Button className={navButtonClass("/graphs")} variant="ghost" onClick={() => navigate("/graphs")}>
                        Graphs
                    </Button>
                    <Button className={navButtonClass("/categories")} variant="ghost" onClick={() => navigate("/categories")}>
                        Category groups
                    </Button>
                    <Button className={navButtonClass("/profile")} variant="ghost" onClick={() => navigate("/profile")}>
                        Profile
                    </Button>
                </nav>
                <div className="ml-auto flex items-center gap-3">
                    <Show when="signed-in">
                        <Select
                            value={activeProfile?.id}
                            onValueChange={setActiveProfileId}
                        >
                            <SelectTrigger
                                aria-label="Active profile"
                                className="max-w-[16rem] border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
                            >
                                <SelectValue placeholder="Profile" />
                            </SelectTrigger>
                            <SelectContent align="end" position="popper">
                                {profiles.filter((profile) => profile.id).map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                        {profile.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 hover:text-white"
                            aria-label="New profile"
                            onClick={() => { setNewName(""); setShowCreate(true); }}
                        >
                            <Plus />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 hover:text-white"
                            aria-label="Manage sharing"
                            onClick={() => navigate("/profile")}
                        >
                            <Settings />
                        </Button>
                        <UserButton />
                    </Show>
                </div>
            </header>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <form onSubmit={handleCreate}>
                        <DialogHeader>
                            <DialogTitle>New profile</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            <Label htmlFor="new-profile-name">Name</Label>
                            <Input
                                id="new-profile-name"
                                value={newName}
                                onChange={(event) => setNewName(event.target.value)}
                                placeholder="Family, Business, ..."
                                maxLength={80}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!newName.trim() || creating}>
                                {creating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

const Home = () => {
    return <Header />;
};

export default Home;
