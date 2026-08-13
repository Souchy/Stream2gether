import { ILogger, resolve } from "aurelia";


export class WelcomePage {
  private readonly logger = resolve(ILogger).scopeTo("WelcomePage");
  public message = 'Welcome to Aurelia 2!';


  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | undefined = undefined;

  private localVideo: HTMLVideoElement | undefined = undefined;
  private remoteVideo: HTMLVideoElement | undefined = undefined;


  // Bound to the textarea in HTML
  public connectionCode: string = '';

  // 1. Setup the connection configurations (Using Google's free NAT Punching servers)
  private rtcConfig: RTCConfiguration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }

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

    // this.peerConnection.onicegatheringstatechange = (): void => {
    //   if (!this.peerConnection)
    //     return;
    //   if (this.peerConnection.iceGatheringState === 'complete') {
    //     if (this.peerConnection.localDescription) {
    //       try {
    //         // Now that gathering is complete, the public STUN IP is guaranteed to be there
    //         this.connectionCode = this.sdpToShortToken(this.peerConnection.localDescription);
    //         console.log("Your ultra-short lobby code is ready:", this.connectionCode);

    //         // Trigger a UI update here if your SPA framework requires it (e.g., ChangeDetectorRef in Angular)
    //       } catch (error) {
    //         console.error("Failed to generate token even after gathering complete:", error);
    //       }
    //     }
    //   }
    // };

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

      // this.peerConnection.onicegatheringstatechange = (): void => {
      //   if (!this.peerConnection)
      //     return;
      //   if (this.peerConnection.iceGatheringState === 'complete') {
      //     if (this.peerConnection.localDescription) {
      //       try {
      //         // Now that gathering is complete, the public STUN IP is guaranteed to be there
      //         this.connectionCode = this.sdpToShortToken(this.peerConnection.localDescription);
      //         console.log("Your ultra-short lobby code is ready:", this.connectionCode);

      //         // Trigger a UI update here if your SPA framework requires it (e.g., ChangeDetectorRef in Angular)
      //       } catch (error) {
      //         console.error("Failed to generate token even after gathering complete:", error);
      //       }
      //     }
      //   }
      // };

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


  //   /**
  //  * Shrinks an RTCSessionDescription down to a short, single-line string token.
  //  * @throws Error if the required ICE candidates or security fields are missing.
  //  */
  //   public sdpToShortToken(sdpObj: RTCSessionDescriptionInit | null): string {
  //     const sdp = sdpObj?.sdp;
  //     if (!sdp || !sdpObj.type) {
  //       throw new Error("Invalid session description object.");
  //     }

  //     // 1. Extract unique security tokens using regex
  //     const ufragMatch = sdp.match(/a=ice-ufrag:(.+)/);
  //     const pwdMatch = sdp.match(/a=ice-pwd:(.+)/);
  //     const fingerprintMatch = sdp.match(/a=fingerprint:sha-256 (.+)/);

  //     // 2. Extract ONLY the primary public STUN candidate line (UDP, server reflexive)
  //     const candidateMatch = sdp.match(/a=candidate:.+ UDP .+ (\d+\.\d+\.\d+\.\d+) (\d+) typ srflx/);

  //     // Strict validation checks for all regex matches
  //     if (!ufragMatch || !pwdMatch || !fingerprintMatch || !candidateMatch) {
  //       throw new Error("STUN candidate or crypto fingerprints are not ready yet. Ensure ICE gathering is complete.");
  //     }

  //     const ufrag = ufragMatch[1];
  //     const pwd = pwdMatch[1];
  //     const fingerprint = fingerprintMatch[1];
  //     const ip = candidateMatch[1];
  //     const port = candidateMatch[2];
  //     const type = sdpObj.type;

  //     // 3. Join into a tight array and Base64 encode it
  //     const compactArray: string[] = [type, ufrag, pwd, fingerprint, ip, port];
  //     return btoa(compactArray.join('|'));
  //   }

  //   /**
  //    * Rebuilds a compliant RTCSessionDescriptionInit from a short string token.
  //    * @throws Error if the token format is invalid.
  //    */
  //   public shortTokenToSDP(token: string): RTCSessionDescriptionInit {
  //     const decoded = atob(token);
  //     const parts = decoded.split('|');

  //     if (parts.length !== 6) {
  //       throw new Error("Invalid connection token format.");
  //     }

  //     const [type, ufrag, pwd, fingerprint, ip, port] = parts;

  //     // Validate that the type is strictly one of the allowed WebRTC types
  //     if (type !== 'offer' && type !== 'answer' && type !== 'pranswer' && type !== 'rollback') {
  //       throw new Error(`Unsupported session description type: ${type}`);
  //     }

  //     // Re-template a bare-bones valid SDP structure that the browser will accept
  //     const sdpTemplate = `v=0
  // o=- ${Date.now()} 2 IN IP4 127.0.0.1
  // s=-
  // t=0 0
  // a=msid-semantic: WMS
  // m=video 9 UDP/TLS/RTP/SAVPF 96
  // c=IN IP4 ${ip}
  // a=rtpmap:96 VP8/90000
  // a=ice-ufrag:${ufrag}
  // a=ice-pwd:${pwd}
  // a=fingerprint:sha-256 ${fingerprint}
  // a=setup:${type === 'offer' ? 'actpass' : 'active'}
  // a=candidate:1 1 UDP 2122260223 ${ip} ${port} typ srflx
  // `;

  //     return {
  //       type: type as RTCSessionDescriptionInit['type'],
  //       sdp: sdpTemplate
  //     };
  //   }


}
