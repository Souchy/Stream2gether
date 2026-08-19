import { route } from "@aurelia/router";


@route({
	id: 'about',
	path: ['about'],
	title: 'About',
})
export class AboutPage {
  public message = 'About Aurelia 2 Router';
} 
