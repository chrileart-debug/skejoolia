import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialsModal } from "./TutorialsModal";

export function HelpFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-40 right-4 z-50 h-12 w-12 rounded-full shadow-lg lg:bottom-20 lg:right-6"
        aria-label="Abrir central de ajuda"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <TutorialsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
