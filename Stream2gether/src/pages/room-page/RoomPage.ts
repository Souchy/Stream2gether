import { IRouter, Params, route, RouteNode } from "@aurelia/router";
import { ILogger, resolve } from "aurelia";
import { RoomSessionService } from "src/core/services/RoomService";

@route({
	id: "room",
	path: ["room/:code"],
	title: 'Room'
})
export class RoomPage {
	private readonly logger = resolve(ILogger).scopeTo("WelcomePage");
	private readonly router = resolve(IRouter);
	private readonly roomService = resolve(RoomSessionService);

	//#region Lifecycle
	public async canLoad(params: Params, next: RouteNode, current: RouteNode | null): Promise<boolean> {
		// const code = typeof params.code === "string" ? params.code : undefined;
		const code = params.code;
		if (!code)
			return false;
		return await this.roomService.joinByCode(code);
	}

	public async loading(): Promise<void> {
		await this.roomService.connect();
	}

	public async dispose() {
		await this.roomService.disconnect();
	}

	public get roomCode() {
		return this.roomService.roomCode;
	}
	//#endregion

}
