import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './routes';
import { authInterceptor } from './core/auth-interceptor';
import { SettingsService } from './core/settings-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      // Carga public/config.json (URL de la API) antes de arrancar la app.
      provide: APP_INITIALIZER,
      multi: true,
      deps: [SettingsService],
      useFactory: (settings: SettingsService) => () => settings.load(),
    },
  ],
};
