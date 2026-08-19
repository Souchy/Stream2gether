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
