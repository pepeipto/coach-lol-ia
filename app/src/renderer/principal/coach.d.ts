import type { ApiCoach } from '../../shared/tiposApp';

declare global {
  interface Window {
    coach: ApiCoach;
  }
}
export {};
