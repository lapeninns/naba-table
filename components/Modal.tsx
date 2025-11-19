"use client";

import { X } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalProps {
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// A simple modal component which can be shown/hidden with a boolean and a function.
const Modal = ({ isModalOpen, setIsModalOpen }: ModalProps) => {
  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="h-full max-w-3xl p-6 md:p-8">
        <DialogHeader className="mb-2 flex flex-row items-start justify-between space-y-0">
          <div>
            <DialogTitle className="font-semibold">I&apos;m a modal</DialogTitle>
            <DialogDescription className="sr-only">Modal content</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close modal">
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </DialogClose>
        </DialogHeader>

        <section>And here is my content</section>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
