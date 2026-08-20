import { route } from '@aurelia/router';
import { WelcomePage } from './pages/welcome-page/WelcomePage';
import { AboutPage } from './pages/about-page/about-page';
import { ILogger, resolve } from 'aurelia';
import { RoomPage } from './pages/room-page/RoomPage';

@route({
  routes: [
    WelcomePage,
    AboutPage,
    RoomPage
  ],
})
export class MyApp {
  private readonly logger = resolve(ILogger).scopeTo("MyApp");

  attached() {
    const emoji = '🍌';
    const svgFavicon = `<svg xmlns='http://w3.org' viewBox='0 0 16 16'><text y='14' font-size='14'>${emoji}</text></svg>`;
    const dataUri = `data:image/svg+xml,${encodeURIComponent(svgFavicon)}`;

    let link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
    link.href = dataUri;

    if (!link.parentNode) {
      document.head.appendChild(link);
    }
  }

  public clickToggleTheme() {
    // Check current theme attribute
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.logger.debug("Current theme: ", currentTheme);

    // Swap the theme attribute
    if (currentTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else
      if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
  }

}
