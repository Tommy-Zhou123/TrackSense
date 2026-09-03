import { useLocation, useNavigate } from "react-router-dom";
import { Show, UserButton, useUser } from "@clerk/react";
import ShimmerText from "@/components/kokonutui/shimmer-text";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function DropDowns() {
    return (
        <div className="flex flex-wrap gap-3">
            <Select>
                <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Select An Account" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                </SelectContent>
            </Select>
            <Select>
                <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

export const Header = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const newUser = state?.newUser;
    const { user } = useUser();

    return (
        <>
            <header className="flex items-center gap-6 bg-black px-8 py-4 text-white">
                <ShimmerText className="text-2xl from-white via-neutral-400 to-white" text="TrackSense" wrapperClassName="p-0" />
                <nav className="flex items-center gap-2 text-sm">
                    <Button className="text-white hover:bg-white/10 hover:text-white" variant="ghost" onClick={() => navigate("/expenses")}>
                        Expenses
                    </Button>
                </nav>
                <div className="ml-auto">
                    <Show when="signed-in">
                        <UserButton />
                    </Show>
                </div>
            </header>
            <section className="bg-muted/60 px-8 py-8">
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                    {newUser ? "Welcome to TrackSense!" : "Welcome Back!"}
                </h1>
                {user?.firstName ? (
                    <p className="mt-2 text-lg text-muted-foreground">Hello, {user.firstName} {user.lastName}</p>
                ) : null}
                <div className="pt-6">
                    <DropDowns />
                </div>
            </section>
        </>
    );
};

const Home = () => {
    return <Header />;
};

export default Home;
