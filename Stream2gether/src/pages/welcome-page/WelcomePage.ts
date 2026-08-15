import { ILogger, resolve } from "aurelia";
import { IRouter, route } from "@aurelia/router";
import { Database } from "src/core/generated/database.types";
import { supabase } from "src/main";
import { INotificationService } from "src/core/services/NotificationService";

@route({
	id: 'welcome',
	path: ['', 'welcome'],
	title: 'Bananas',
})
export class WelcomePage {
	private readonly logger = resolve(ILogger).scopeTo("WelcomePage");
	private readonly router: IRouter = resolve(IRouter);
	private notifications = resolve(INotificationService);

	public code: string = "";

	public async clickCreateRoom() {
		// try {
			let response = await supabase.rpc("create_lobby");
			if (response.success) {
				const data = response.data[0];
				const code = data.code;
				const roomUrl = `room/${code}`;
				await navigator.clipboard.writeText(roomUrl);
				this.notifications.success("Room URL copied to clipboard!", "", 1000);
				this.logger.debug("Created a room: ", response);
				// await this.router.load(roomUrl);
			} else {
				// alert("error: " + response.error.message);
				this.notifications.error("Failed to create a room", response.error.message, 5000);
				this.logger.debug(`Error on create_lobby(): `, response);
			}
		// } catch (exception) {
		// 	this.notifications.error("Failed to create a room", exception as string ?? "", 3000);
		// 	this.logger.debug(`Error on create_lobby(): `, exception);
		// }
	}

	public async clickJoinRoom() {
		const code = this.code;
		const roomUrl = `room/${code}`;
		await this.router.load(roomUrl);
	}

}
