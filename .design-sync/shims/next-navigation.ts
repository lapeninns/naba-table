// design-sync preview shim for next/navigation — static no-op router so
// components calling usePathname/useRouter render without an App Router context.
export const usePathname = () => '/';
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
});
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
export const redirect = () => {};
export const permanentRedirect = () => {};
export const notFound = () => {};
export const RedirectType = { push: 'push', replace: 'replace' };
