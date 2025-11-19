"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ButtonGradient = ({
  title = "Gradient Button",
  onClick = () => {},
}: {
  title?: string;
  onClick?: () => void;
}) => {
  return (
    <Button
      className={cn("btn-gradient animate-shimmer")}
      onClick={onClick}
      type="button"
    >
      {title}
    </Button>
  );
};

export default ButtonGradient;
