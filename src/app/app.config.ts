import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { FontsService } from './services/fonts.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Instantiating FontsService applies the user's stored font stacks (or
    // the shipped defaults) to <html> before the first component renders,
    // so we don't get a flash of the SCSS-fallback fonts when a user has
    // customised them.
    provideAppInitializer(() => {
      inject(FontsService);
    }),
  ],
};
