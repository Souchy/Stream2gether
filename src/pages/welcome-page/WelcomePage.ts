import { ILogger, resolve, watch } from "aurelia";
import { IRouter, route } from "@aurelia/router";
import { supabase } from "src/main";
import { INotificationService } from "src/core/services/NotificationService";
import { Room } from "src/core/models/Room";
import { NameService } from "src/core/services/NameService";
import { RoomSessionService } from "src/core/services/RoomSessionService";

@route({
	id: 'welcome',
	path: ['', 'welcome'],
	title: 'Bananas',
})
export class WelcomePage {
	private readonly logger = resolve(ILogger).scopeTo("WelcomePage");
	private readonly router: IRouter = resolve(IRouter);
	private readonly notifications = resolve(INotificationService);
	private readonly roomSession = resolve(RoomSessionService);

	public code: string = "";
	private checkRoomsInterval?: number;
	private rooms: Room[] = [];

	constructor() {
		void this.checkActiveRooms();
		// this.checkRoomsInterval = setInterval(async () => await this.checkActiveRooms(), 3000);
	}

	private async checkActiveRooms() {
		const response = await supabase.rpc("get_my_active_lobbies");
		if (response.error) {
			clearInterval(this.checkRoomsInterval);
			this.checkRoomsInterval = undefined;
			return;
		}

		this.rooms = response.data;
		this.logger.debug("Fetched user's active rooms: ", this.rooms);
	}

	public async clickCreateRoom() {
		await this.roomSession.ensureSignedIn();

		let response = await supabase.rpc("create_lobby");
		if (response.success) {
			const data = response.data[0];
			const code = data.code;
			const roomUrl = `room/${code}`;

			// const fullUrl = `${window.location.origin}/${roomUrl}`; 
			const fullUrl = new URL(`/room/${code}`, window.location.origin).toString();
			await navigator.clipboard.writeText(fullUrl);
			this.notifications.success("Room URL copied to clipboard!", "", 1000);
			this.logger.debug("Created a room: ", response);

			await this.router.load(roomUrl);
		} else {
			// alert("error: " + response.error.message);
			this.notifications.error("Failed to create a room", response.error.message, 5000);
			this.logger.debug(`Error on create_lobby(): `, response);
		}
	}

	public async clickJoinRoom() {
		const code = this.code;
		const roomUrl = `room/${code}`;
		await this.router.load(roomUrl);
	}

}
