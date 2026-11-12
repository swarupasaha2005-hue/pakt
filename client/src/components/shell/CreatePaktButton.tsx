"use client";

import { useState } from "react";
import { CreatePaktModal } from "@/components/modals/CreatePaktModal";
import { Button } from "@/components/ui/Button";

/** primary "+ Create a pakt" button with its modal */
export function CreatePaktButton({ label = "Create pakt" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="whitespace-nowrap text-sm! font-medium!">
        {label}
      </Button>
      {open && <CreatePaktModal onClose={() => setOpen(false)} />}
    </>
  );
}
