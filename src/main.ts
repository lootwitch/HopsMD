import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[HopsMD] Sud verschüttet beim Anstich:', err);
});
