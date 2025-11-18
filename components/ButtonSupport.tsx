"use client";

import { MessageCircle } from "lucide-react";
import { Crisp } from "crisp-sdk-web";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import config from "@/config";

// Use this button if chat is hidden on some routes. config.js has onlyShowOnRoutes set to ["/"] so it will be hidden on all routes except the home page.
// If Crisp is not enable, it will open the support email in the default email client.
const ButtonSupport = () => {
  const handleClick = () => {
    if (config.crisp?.id) {
      Crisp.chat.show();
      Crisp.chat.open();
    } else if (config.email?.supportEmail) {
      // open default email client in new window with "need help with ${config.appName}" as subject
      window.open(
        `mailto:${config.email.supportEmail}?subject=Need help with ${config.appName}`,
        "_blank"
      );
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="outline" onClick={handleClick} title="Chat with support">
          <MessageCircle className="h-4 w-4" aria-hidden />
          Support
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Talk to support
      </TooltipContent>
    </Tooltip>
  );
};

export default ButtonSupport;
