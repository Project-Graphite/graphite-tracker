import { useAuth } from './auth';

export function useAdultBlur() {
  const auth = useAuth();
  const blur = !auth.user?.showAdultContent || auth.user.blurAdultContent;
  return (adult: boolean | undefined) => adult === true && blur;
}
