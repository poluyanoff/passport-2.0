import {ApplicationConfig, provideZoneChangeDetection} from '@angular/core';
import {provideEventPlugins} from '@taiga-ui/event-plugins';
import {TBANK_PROVIDERS} from '@taiga-ui/proprietary';
import {tuiAssetsPathProvider} from '@taiga-ui/core/tokens';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({eventCoalescing: true}),
        provideEventPlugins(),
        TBANK_PROVIDERS,
        // Строго после провайдера Т-Банка: он ставит путь на cdn.tbank.ru, где иконки отдают 403.
        tuiAssetsPathProvider('assets/taiga-ui/icons'),
    ],
};
