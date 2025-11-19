"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ButtonPopover = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2" aria-expanded={undefined}>
          Popover Button
          <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-screen max-w-full p-0 sm:max-w-sm lg:max-w-2xl">
        <div className="relative grid gap-4 bg-base-100 p-4 lg:grid-cols-2">
          <div className="text-sm flex items-center gap-3 p-2 cursor-pointer rounded-lg duration-200 hover:bg-base-200">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6 stroke-orange-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"
                />
              </svg>
            </span>
            <div>
              <p className="font-bold">Get Started</p>
              <p className="opacity-70">Loreum ipseum de la madre de papa</p>
            </div>
          </div>
          <div className="text-sm flex items-center gap-3 p-2 cursor-pointer rounded-lg duration-200 hover:bg-base-200">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-yellow-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6 stroke-yellow-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
            </span>
            <div>
              <p className="font-bold">Rewards</p>
              <p className="opacity-70">Loreum ipseum de el papi de la mama</p>
            </div>
          </div>
          <div className="text-sm flex items-center gap-3 p-2 cursor-pointer rounded-lg duration-200 hover:bg-base-200">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6 stroke-green-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 01112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 01112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              </svg>
            </span>
            <div>
              <p className="font-bold">Academics</p>
              <p className="opacity-70">Loreum ipseum de la madre de papa</p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ButtonPopover;
