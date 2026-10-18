import type { ApiOverlay } from '../../shared/tiposApp';

declare global {
  interface Window {
    coachOverlay: ApiOverlay;
  }
}
export {};
