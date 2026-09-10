import { useLocation, useNavigate } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import ShimmerText from "@/components/kokonutui/shimmer-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/components/ProfileProvider";

export const Header = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { profiles, activeProfile, setActiveProfileId } = useProfile();

    const navButtonClass = (path: string) =>
        cn(
            "text-white hover:bg-white/10 hover:text-white",
            pathname === path && "bg-white/15",
        );

    return (
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
                    <UserButton />
                </Show>
            </div>
        </header>
    );
};

const Home = () => {
    return <Header />;
};

export default Home;
