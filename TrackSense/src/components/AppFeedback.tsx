import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export const GENERIC_ERROR = "Something went wrong. Please try again.";

export type ConfirmOptions = {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};

type AppFeedbackValue = {
    reportError: (error?: unknown) => void;
    showSuccess: (message: string) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AppFeedbackContext = createContext<AppFeedbackValue | null>(null);

export function useAppFeedback(): AppFeedbackValue {
    const value = useContext(AppFeedbackContext);
    if (!value) {
        throw new Error("useAppFeedback must be used within AppFeedbackProvider");
    }
    return value;
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
    const [errorOpen, setErrorOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const reportError = useCallback((error?: unknown) => {
        if (error !== undefined) console.error(error);
        setSuccessMessage(null);
        setErrorOpen(true);
    }, []);

    const showSuccess = useCallback((message: string) => {
        setErrorOpen(false);
        setSuccessMessage(message);
    }, []);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setConfirmOpts(options);
            setConfirmOpen(true);
        });
    }, []);

    const settleConfirm = useCallback((value: boolean) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setConfirmOpen(false);
        resolve?.(value);
    }, []);

    return (
        <AppFeedbackContext.Provider value={{ reportError, showSuccess, confirm }}>
            {children}
            {errorOpen ? (
                <div
                    className="fixed bottom-4 left-1/2 z-[80] flex w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm shadow-lg"
                    role="alert"
                >
                    <p className="flex-1 text-destructive">{GENERIC_ERROR}</p>
                    <button
                        type="button"
                        className="rounded-xs text-muted-foreground opacity-70 hover:opacity-100"
                        aria-label="Dismiss error"
                        onClick={() => setErrorOpen(false)}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ) : null}
            {successMessage ? (
                <div
                    className="fixed bottom-4 left-1/2 z-[80] flex w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm shadow-lg"
                    role="status"
                >
                    <p className="flex-1">{successMessage}</p>
                    <button
                        type="button"
                        className="rounded-xs text-muted-foreground opacity-70 hover:opacity-100"
                        aria-label="Dismiss"
                        onClick={() => setSuccessMessage(null)}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ) : null}
            <Dialog
                open={confirmOpen}
                onOpenChange={(open) => {
                    if (!open) settleConfirm(false);
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="z-[70] sm:max-w-md"
                    overlayClassName="z-[70]"
                >
                    <DialogHeader>
                        <DialogTitle>{confirmOpts?.title}</DialogTitle>
                        <DialogDescription>{confirmOpts?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => settleConfirm(false)}>
                            {confirmOpts?.cancelLabel || "Cancel"}
                        </Button>
                        <Button
                            type="button"
                            variant={confirmOpts?.destructive ? "destructive" : "default"}
                            onClick={() => settleConfirm(true)}
                        >
                            {confirmOpts?.confirmLabel || "Continue"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppFeedbackContext.Provider>
    );
}
