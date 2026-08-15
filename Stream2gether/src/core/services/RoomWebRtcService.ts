import { IEventAggregator, ILogger, resolve, singleton } from "aurelia";
import { StreamSettingsService } from "./StreamSettingsService";
import { RoomPresence, RoomSessionService } from "./RoomSessionService";
import { LobbyMemberStatus } from "../models/Room";

export const EventBroadcastSignal = "webrtc:broadcast:signal";
export const EventLobbyMemberChanged = "lobby_member:changed";
export const EventPresenceSync = "presence:sync";
export const EventPresenceJoin = "presence:join";
export const EventPresenceLeave = "presence:leave";

@singleton()
export class RoomWebRtcService {
	private readonly logger = resolve(ILogger).scopeTo("RoomWebRtcService");
	private readonly settings = resolve(StreamSettingsService);
	private readonly roomSession = resolve(RoomSessionService);
	private readonly ea = resolve(IEventAggregator);

	public readonly rtcConfig: RTCConfiguration = {
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" },
		],
	};

	public localStream?: MediaStream;
	// public remoteHostStream?: MediaStream;

	private peerConnections = new Map<string, RTCPeerConnection>();


	public initialize() {
		// On signal receive
		this.ea.subscribe(EventBroadcastSignal, async (msg: SignalEnvelope) => await this.handleSignal(msg));

		this.ea.subscribe(EventLobbyMemberChanged, ({ user_id, status }) => {
			this.logger.debug("EventLobbyMemberChanged", user_id, status);
			this.handleViewerReady(user_id, status);
		})

		this.ea.subscribe(EventPresenceSync, () => {
			this.logger.debug("EventPresenceSync")
		});

		this.ea.subscribe(EventPresenceJoin, (joinedUsers: RoomPresence[]) => {
			this.logger.debug("EventPresenceJoin", joinedUsers)
			for (const joined of joinedUsers)
				this.handleViewerReady(joined.user_id, joined.lobby_status);
		});

		this.ea.subscribe(EventPresenceLeave, (leftUsers: RoomPresence[]) => {
			this.logger.debug("EventPresenceLeave", leftUsers)
			for (const left of leftUsers)
				this.closePeer(left.user_id);
		});
	}

	public async startHosting(): Promise<void> {
		for (const user of this.roomSession.onlineMembers) {
			void this.handleViewerReady(user.user_id, user.lobby_status);
		}
	}
	// public async stopHosting(): Promise<void> { }

	// public async startViewing(): Promise<void> { }
	// public async stopViewing(): Promise<void> { }

	public async handleSignal(message: SignalEnvelope): Promise<void> {
		if (message.toUserId !== this.roomSession.currentUserId) return;
		if (message.fromUserId === this.roomSession.currentUserId) return;

		this.logger.debug("Handle Signal: ", message);

		switch (message.type) {
			// case "viewer-ready":
			// 	await this.handleViewerReady(message);
			// 	return;
			case "offer":
				await this.handleOffer(message);
				return;

			case "answer":
				await this.handleAnswer(message);
				return;

			case "ice-candidate":
				await this.handleIceCandidate(message);
				return;

			case "hangup":
				this.closePeer(message.fromUserId);
				return;
		}
	}

	private createPeerConnection(remoteUserId: string): RTCPeerConnection {
		const pc = new RTCPeerConnection(this.rtcConfig);

		pc.onicecandidate = (event) => {
			if (!event.candidate) return;

			void this.roomSession.sendSignal({
				type: "ice-candidate",
				fromUserId: this.roomSession.currentUserId!,
				toUserId: remoteUserId,
				candidate: event.candidate.toJSON(),
			});
		};

		pc.onconnectionstatechange = () => {
			this.logger.debug("pc state", remoteUserId, pc.connectionState);
			if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
				this.closePeer(remoteUserId);
			}
		};

		this.peerConnections.set(remoteUserId, pc);
		return pc;
	}

	private closePeer(remoteUserId: string): void {
		const pc = this.peerConnections.get(remoteUserId);
		if (!pc) return;

		pc.onicecandidate = null;
		pc.ontrack = null;
		pc.onconnectionstatechange = null;

		pc.close();
		this.peerConnections.delete(remoteUserId);

		// if (!this.roomSession.isHost) {
		// 	this.remoteHostStream = undefined;
		// }
	}

	public dispose(): void {
		for (const remoteUserId of this.peerConnections.keys()) {
			this.closePeer(remoteUserId);
		}

		this.localStream?.getTracks().forEach(track => track.stop());
		this.localStream = undefined;
		// this.remoteHostStream = undefined;
	}

	//#region Handlers
	/**
	 * Start a stream to a new viewer
	 * @param message 
	 * @returns 
	 */
	// private async handleViewerReady(message: Extract<SignalEnvelope, { type: "viewer-ready" }>) {
	private async handleViewerReady(user_id: string, status: LobbyMemberStatus) { //userPresence: RoomPresence) {
		if (!this.roomSession.isHost) return;
		if (!this.localStream) return;
		if (!this.roomSession.currentUserId) return;
		if (this.roomSession.currentUserId == user_id) return;
		if (status != "joined") return;

		// const remoteUserId = message.fromUserId;
		const remoteUserId = user_id;

		const pc = this.createPeerConnection(remoteUserId);

		for (const track of this.localStream.getTracks()) {
			pc.addTrack(track, this.localStream);
		}

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		await this.roomSession.sendSignal({
			type: "offer",
			fromUserId: this.roomSession.currentUserId!,
			toUserId: remoteUserId,
			sdp: offer,
		});
	}

	/**
	 * Receive the host's offer and return an answer
	 * @param message 
	 * @returns 
	 */
	private async handleOffer(message: Extract<SignalEnvelope, { type: "offer" }>) {
		if (this.roomSession.isHost) return;
		if (!this.roomSession.currentUserId) return;
		// this.logger.debug("Handle offer: ", message);

		const remoteUserId = message.fromUserId;
		const pc = this.createPeerConnection(remoteUserId);

		pc.ontrack = (event) => {
			const [stream] = event.streams;
			if (stream) {
				// this.remoteHostStream = stream;
				this.localStream = stream;
				this.ea.publish("stream", stream);
				this.logger.debug("Received remote host stream", {
					// remoteUserId,
					streamId: stream.id,
				});
			}
		};

		await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);

		await this.roomSession.sendSignal({
			type: "answer",
			fromUserId: this.roomSession.currentUserId!,
			toUserId: remoteUserId,
			sdp: answer,
		});
	}

	private async handleAnswer(message: Extract<SignalEnvelope, { type: "answer" }>) {
		const pc = this.peerConnections.get(message.fromUserId);
		if (!pc) return;

		await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
	}

	private async handleIceCandidate(message: Extract<SignalEnvelope, { type: "ice-candidate" }>) {
		const pc = this.peerConnections.get(message.fromUserId);
		if (!pc) return;

		await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
	}

	//#endregion
}

export type SignalEnvelope =
	| {
		type: "viewer-ready";
		fromUserId: string;
		toUserId: string;
	}
	| {
		type: "offer";
		fromUserId: string;
		toUserId: string;
		sdp: RTCSessionDescriptionInit;
	}
	| {
		type: "answer";
		fromUserId: string;
		toUserId: string;
		sdp: RTCSessionDescriptionInit;
	}
	| {
		type: "ice-candidate";
		fromUserId: string;
		toUserId: string;
		candidate: RTCIceCandidateInit;
	}
	| {
		type: "hangup";
		fromUserId: string;
		toUserId: string;
	};
