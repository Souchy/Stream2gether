import { resolve } from "aurelia";
import { RoomPresence, RoomSessionService } from "src/core/services/RoomSessionService";


export class RoomMemberList {
	private readonly room = resolve(RoomSessionService);


	public get currentUserId() {
		return this.room.currentUserId;
	}

	public get members(): RoomPresence[] {
		return this.room.onlineMembers;
	}

}
