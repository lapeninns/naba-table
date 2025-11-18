"use client";

import React, { useState, useRef } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import apiClient from "@/libs/api";

// This component is used to collect the emails from the landing page
// You'd use this if your product isn't ready yet or you want to collect leads
// For instance: A popup to send a freebie, joining a waitlist, etc.
// It calls the /api/lead/route.js route and store a Lead document in the database
const ButtonLead = ({ extraStyle }: { extraStyle?: string }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    setIsLoading(true);
    try {
      await apiClient.post("/lead", { email });

      toast.success("Thanks for joining the waitlist!");

      // just remove the focus on the input
      inputRef.current?.blur();
      setEmail("");
      setIsDisabled(true);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form className={cn("w-full max-w-xs space-y-3", extraStyle)} onSubmit={handleSubmit}>
      <Input
        required
        type="email"
        value={email}
        ref={inputRef}
        autoComplete="email"
        placeholder="tom@cruise.com"
        onChange={(e) => setEmail(e.target.value)}
      />

      <Button className="w-full" type="submit" disabled={isDisabled} aria-busy={isLoading}>
        Join waitlist
        {isLoading ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 animate-spin"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M10 3.5a.75.75 0 01.75-.75 6.75 6.75 0 016.5 6.75.75.75 0 01-1.5 0A5.25 5.25 0 0010.75 4.25.75.75 0 0110 3.5z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </Button>
    </form>
  );
};

export default ButtonLead;
