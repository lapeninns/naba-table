export type Theme = 'light' | 'dark' | '';

export interface ConfigProps {
  appName: string;
  appDescription: string;
  domainName: string;
  locale: string;
  crisp: {
    id?: string;
    onlyShowOnRoutes?: string[];
  };
  aws?: {
    bucket?: string;
    bucketUrl?: string;
    cdn?: string;
  };
  email: {
    fromNoReply: string;
    fromSupport: string;
    supportEmail?: string;
    forwardRepliesTo?: string;
    platformReplyTo: string;
  };
  colors: {
    theme: Theme;
    main: string;
  };
  auth: {
    loginUrl: string;
    callbackUrl: string;
  };
}
