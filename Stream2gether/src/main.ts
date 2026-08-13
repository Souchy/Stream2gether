import Aurelia, { ConsoleSink, LoggerConfiguration, LogLevel } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';

// Aurelia
//   .register(RouterConfiguration)
//   // To use HTML5 pushState routes, replace previous line with the following
//   // customized router config.
//   // .register(RouterConfiguration.customize({ useUrlFragmentHash: false }))
//   .app(MyApp)
//   .start();



async function startApp() {
  const au = new Aurelia();

  // Logger for development
  // if (import.meta.env.VITE_NODE_ENV !== 'production') {
  const logger = LoggerConfiguration.create({
    level: LogLevel.debug,
    colorOptions: 'colors',
    sinks: [ConsoleSink]
  });
  au.register(logger);
  // }

	// Router
	au.register(RouterConfiguration.customize({
		useNavigationModel: true,
		useUrlFragmentHash: false,
		historyStrategy: 'push',
		basePath: '/',
	}));


  await au.app(MyApp).start();
}

void startApp();
