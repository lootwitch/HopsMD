import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { ContentZoomService } from './services/content-zoom.service';
import { FontsService } from './services/fonts.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Instantiating FontsService applies the user's stored font stacks (or
    // the shipped defaults) to <html> before the first component renders,
    // so we don't get a flash of the SCSS-fallback fonts when a user has
    // customised them. ContentZoomService follows the same pattern for the
    // persisted content zoom level and wires up the Ctrl+Wheel listener.
    provideAppInitializer(() => {
      inject(FontsService);
      inject(ContentZoomService);
    }),
  ],
};
