import { IEventAggregator, ILogger, resolve } from "aurelia";
import { RoomSessionService } from "src/core/services/RoomSessionService";
import { RoomWebRtcService } from "src/core/services/RoomWebRtcService";
import { StreamSettingsService } from "src/core/services/StreamSettingsService";


export class RoomStream {
	private readonly logger = resolve(ILogger).scopeTo("RoomStream");
	private readonly roomService = resolve(RoomSessionService);
	private readonly settingsService = resolve(StreamSettingsService);
	private readonly webrtc = resolve(RoomWebRtcService);
	private readonly ea = resolve(IEventAggregator);

	// private peerConnection: RTCPeerConnection | null = null;
	// private localStream: MediaStream | undefined = undefined;

	private localVideo!: HTMLVideoElement;
	// private remoteVideo?: HTMLVideoElement;

	// Bound to the textarea in HTML
	// public connectionCode: string = '';

	// 1. Setup the connection configurations (Using Google's free NAT Punching servers)
	// private rtcConfig: RTCConfiguration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }

	private hoverShowSettings = false;
	private toggleShowSettings = false;

	//#region Lifecycle
	public binding() {
		this.ea.subscribe("stream", (screenStream:  MediaProvider | null) => {
			this.localVideo.srcObject = screenStream;
		})
		this.webrtc.initialize();
	}
	public dispose() {
		this.webrtc.dispose();
	}
	//#endregion

	public get isHost() {
		return this.roomService.isHost;
	}

	async selectDevice() {
		try {
			// Request permission to capture the display surface
			const options = this.settingsService.getDisplayMediaStreamOptions();
			const screenStream = await navigator.mediaDevices.getDisplayMedia(options);
			// navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			
			// this.localStream = screenStream;
			// this.localVideo.srcObject = this.localStream;
			this.webrtc.localStream = screenStream;
			this.localVideo.srcObject = screenStream;
		} catch (error) {
			this.logger.debug("Error selecting stream source", error);
		}

		// await this.startHost();
		await this.webrtc.startHosting();
	}


	// 2. THE HOST FLOW: Start streaming and generate the "Offer"
	// public async startHost() {
	// 	this.logger.debug("start host");
	// 	if (!this.localVideo || !this.localStream) {
	// 		// alert("internal binding error");
	// 		return;
	// 	}

	// 	// Create connection
	// 	this.peerConnection = new RTCPeerConnection(this.rtcConfig);
	// 	if (!this.peerConnection) {
	// 		return;
	// 	}

	// 	// Push video tracks into the P2P connection
	// 	for (const track of this.localStream.getTracks())
	// 		this.peerConnection.addTrack(track, this.localStream)

	// 	// Create the connection offer
	// 	const offer = await this.peerConnection.createOffer();
	// 	await this.peerConnection.setLocalDescription(offer);

	// 	// Wait briefly for ICE candidates (the NAT hole punch addresses) to gather
	// 	this.peerConnection.onicecandidate = this.onIceCandicate;
	// }

	// private readonly onIceCandicate = async (event: RTCPeerConnectionIceEvent) => {
	// 	this.logger.debug("onicecandidate event: ", event)
	// 	if (!event.candidate && this.peerConnection != null) {
	// 		// Once finished gathering, the full connection code sits in localDescription
	// 		// this.connectionCode = btoa(JSON.stringify(this.peerConnection.localDescription));
	// 		this.connectionCode = await this.compressSDP(this.peerConnection.localDescription);
	// 		// this.connectionCode = this.sdpToShortToken(this.peerConnection.localDescription);
	// 		this.logger.debug("set code: ", this.connectionCode);
	// 	}
	// };


	// 3. THE FRIEND FLOW: Take Host's code, create an "Answer"
	// public async joinFriend() {
	// 	if (!this.connectionCode) 
	// 		return alert('Paste the host code first!');

	// 	// const parsedData = JSON.parse(atob(this.connectionCode));
	// 	const parsedData = await this.decompressSDP(this.connectionCode);
	// 	// const parsedData = this.shortTokenToSDP(this.connectionCode);

	// 	// If we don't have a peer connection yet, we are the receiver
	// 	if (!this.peerConnection) {
	// 		this.peerConnection = new RTCPeerConnection(this.rtcConfig);

	// 		this.peerConnection.ontrack = (event) => {
	// 			if (this.localVideo) {
	// 				this.localVideo.srcObject = event.streams[0];
	// 			} else {
	// 				this.logger.debug("received stream but got no video element ", event);
	// 			}
	// 		};

	// 		await this.peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData));
	// 		const answer = await this.peerConnection.createAnswer();
	// 		await this.peerConnection.setLocalDescription(answer);

	// 		// Wait briefly for ICE candidates (the NAT hole punch addresses) to gather
	// 		this.peerConnection.onicecandidate = this.onIceCandicate

	// 	} else {
	// 		// If the host is pasting the friend's reply code, finish the connection
	// 		await this.peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData));
	// 	}
	// }

	// Helper to copy code to clipboard using Tauri's native API
	// public async copyCode() {
	// 	// await writeText(this.connectionCode);
	// 	await navigator.clipboard.writeText(this.connectionCode);
	// 	alert('Code copied! Send this to your friend.');
	// }


	// async compressPayload(jsonObject: any) {
	//   const stringData = JSON.stringify(jsonObject);
	//   // Convert string to a stream, compress with gzip, and encode to Base64
	//   const stream = new Blob([stringData]).stream().pipeThrough(new CompressionStream('gzip'));
	//   const response = new Response(stream);
	//   const buffer = await response.arrayBuffer();
	//   return btoa(String.fromCharCode(...new Uint8Array(buffer)));
	// }

	// // Decompress and Decode back to an object when pasted
	// async decompressPayload(base64String: string) {
	//   const binary = atob(base64String);
	//   const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
	//   const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	//   const response = new Response(stream);
	//   return JSON.parse(await response.text());
	// }

	async compressSDP(description: RTCSessionDescription | null) {
		const jsonString = JSON.stringify(description);
		// Zip the string using native gzip compression
		const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
		const buffer = await new Response(stream).arrayBuffer();
		// Turn the zipped binary data into a clean Base64 string
		return btoa(String.fromCharCode(...new Uint8Array(buffer)));
	}

	// Decompresses the Base64 string back into an SDP object
	async decompressSDP(base64String: string) {
		const binary = atob(base64String);
		const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
		const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
		return JSON.parse(await new Response(stream).text());
	}


}
