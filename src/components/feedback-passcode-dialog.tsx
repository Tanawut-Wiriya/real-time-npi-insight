import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function FeedbackPasscodeDialog({ open, no, busy, error, onCancel, onConfirm }: {
  open: boolean;
  no: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) { setToken(""); onCancel(); } }}>
      <DialogContent className="max-w-sm" onClick={(event) => event.stopPropagation()} onEscapeKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) { setToken(""); onCancel(); }
      }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>ยืนยันการบันทึกแถว {no}</DialogTitle>
          <DialogDescription>Customer feedback · Remark customer feedback</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !token) return;
          const entered = token;
          setToken("");
          await onConfirm(entered);
        }}>
          <div className="space-y-2">
            <label htmlFor="feedback-passcode" className="text-sm font-medium">รหัสยืนยัน (WRITE_TOKEN)</label>
            <Input id="feedback-passcode" name="passcode" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} disabled={busy} maxLength={4096} autoFocus required />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setToken(""); onCancel(); }}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !token} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busy ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}