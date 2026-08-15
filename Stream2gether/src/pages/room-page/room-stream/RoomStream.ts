import { ILogger, resolve } from "aurelia";
import { RoomSessionService } from "src/core/services/RoomService";


export class RoomStream {
	private readonly logger = resolve(ILogger).scopeTo("RoomStream");
	private readonly roomService = resolve(RoomSessionService);

	private peerConnection: RTCPeerConnection | null = null;
	private localStream: MediaStream | undefined = undefined;

	private localVideo: HTMLVideoElement | undefined = undefined;
	private remoteVideo: HTMLVideoElement | undefined = undefined;

	// Bound to the textarea in HTML
	public connectionCode: string = '';

	// 1. Setup the connection configurations (Using Google's free NAT Punching servers)
	private rtcConfig: RTCConfiguration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }

	private hoverShowSettings = false;
	private toggleShowSettings = false;

	//#region Lifecycle
	public binding() {

	}
	//#endregion

	async selectDevice() {
		try {
			// Request permission to capture the display surface
			const screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					width: { max: 1920 },
					height: { max: 1080 },
					frameRate: { max: 30 }
				},
				audio: true // Set to true if you want to attempt capturing system audio
			} satisfies DisplayMediaStreamOptions);

			return screenStream;
		} catch (error) {
			console.error("Error capturing screen:", error);
		}
	}

	// 2. THE HOST FLOW: Start streaming and generate the "Offer"
	public async startHost() {
		this.logger.debug("start host");
		if (!this.localVideo) {
			alert("internal binding error");
			return;
		}

		this.peerConnection = new RTCPeerConnection(this.rtcConfig);
		if (!this.peerConnection) {
			alert("no connection")
			return;
		}

		// Capture screen or camera
		this.localStream = await this.selectDevice(); // navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		if (!this.localStream) {
			alert("no device selected")
			return;
		}
		this.localVideo.srcObject = this.localStream;
		this.logger.debug("src local src");

		// Push video tracks into the P2P connection
		for (const track of this.localStream.getTracks())
			this.peerConnection.addTrack(track, this.localStream)

		this.logger.debug("added tracks");

		// Listen for the friend's video stream to arrive
		// this.peerConnection.ontrack = (event) => {
		//   if (this.remoteVideo) {
		//     this.remoteVideo.srcObject = event.streams[0];
		//   } else {
		//     this.logger.debug("received stream but got no video element ", event);
		//   }
		// };

		this.logger.debug("create connection offer");
		// Create the connection offer
		const offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);

		// Wait briefly for ICE candidates (the NAT hole punch addresses) to gather
		this.peerConnection.onicecandidate = this.onIceCandicate
	}

	private readonly onIceCandicate = async (event: RTCPeerConnectionIceEvent) => {
		this.logger.debug("onicecandidate event: ", event)
		if (!event.candidate && this.peerConnection != null) {
			// Once finished gathering, the full connection code sits in localDescription
			// this.connectionCode = btoa(JSON.stringify(this.peerConnection.localDescription));
			this.connectionCode = await this.compressSDP(this.peerConnection.localDescription);
			// this.connectionCode = this.sdpToShortToken(this.peerConnection.localDescription);
			this.logger.debug("set code: ", this.connectionCode);
		}
	};


	// 3. THE FRIEND FLOW: Take Host's code, create an "Answer"
	public async joinFriend() {
		if (!this.localVideo) {
			alert("internal binding error");
			return;
		}
		if (!this.connectionCode) return alert('Paste the host code first!');

		// const parsedData = JSON.parse(atob(this.connectionCode));
		const parsedData = await this.decompressSDP(this.connectionCode);
		// const parsedData = this.shortTokenToSDP(this.connectionCode);

		// If we don't have a peer connection yet, we are the receiver
		if (!this.peerConnection) {
			this.peerConnection = new RTCPeerConnection(this.rtcConfig);

			// // Capture receiver's stream if they also want to share video
			// this.localStream = await this.selectDevice(); // navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			// if (this.localStream) {
			//   alert("no device selected")
			//   this.localVideo.srcObject = this.localStream;
			//   for (const track of this.localStream.getTracks())
			//     this.peerConnection.addTrack(track, this.localStream)
			// }

			this.peerConnection.ontrack = (event) => {
				if (this.remoteVideo) {
					this.remoteVideo.srcObject = event.streams[0];
				} else {
					this.logger.debug("received stream but got no video element ", event);
				}
			};

			await this.peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData));
			const answer = await this.peerConnection.createAnswer();
			await this.peerConnection.setLocalDescription(answer);

			// Wait briefly for ICE candidates (the NAT hole punch addresses) to gather
			this.peerConnection.onicecandidate = this.onIceCandicate

		} else {
			// If the host is pasting the friend's reply code, finish the connection
			await this.peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData));
		}
	}

	// Helper to copy code to clipboard using Tauri's native API
	public async copyCode() {
		// await writeText(this.connectionCode);
		await navigator.clipboard.writeText(this.connectionCode);
		alert('Code copied! Send this to your friend.');
	}


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
