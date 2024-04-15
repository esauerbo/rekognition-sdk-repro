import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
} from "@aws-sdk/client-rekognition";
import {
  LivenessRequestStream,
  RekognitionStreamingClient,
  StartFaceLivenessSessionCommand,
} from "@aws-sdk/client-rekognitionstreaming";

import { WebSocketFetchHandler } from "@aws-sdk/middleware-websocket";
import { getAsyncGeneratorFromReadableStream } from "./getAsyncGenerator";
import { VideoRecorder } from "./videoRecorder";

const credentials = JSON.parse(import.meta.env.VITE_CREDENTIALS);
const CONNECTION_TIMEOUT = 10_000;
const region = "us-east-1";

async function createSession() {
  console.log("Creating session...")
  try {
    const client = new RekognitionClient({
      region,
      credentials,
    });
    const response = await client.send(
      new CreateFaceLivenessSessionCommand({})
    );
    const { SessionId: sessionId } = response;
    return sessionId;
  } catch (error) {
    console.error(error);
    throw new Error('Unable to create session');
  }
}

async function startSession(sessionId: string, stream: MediaStream) {
  console.log("Starting session...")
  try {
    const client = new RekognitionStreamingClient({
      credentials,
      region,
      requestHandler: new WebSocketFetchHandler({
        connectionTimeout: CONNECTION_TIMEOUT,
      }),
    });

    const videoRecorder = new VideoRecorder(stream);

    const livenessRequestGenerator: AsyncGenerator<LivenessRequestStream> =
      getAsyncGeneratorFromReadableStream(videoRecorder.videoStream)();

    const response = await client.send(
      new StartFaceLivenessSessionCommand({
        ChallengeVersions: "FaceMovementAndLightChallenge_1.0.0",
        SessionId: sessionId,
        LivenessRequestStream: livenessRequestGenerator,
        VideoWidth: "640",
        VideoHeight: "480",
      })
    );
    console.log(response);
    return response;
  } catch (error) {
    console.error(error)
    throw new Error('Unable to start session');
  }
}

async function createVideoAndGetStream(): Promise<MediaStream> {
  const video = document.querySelector("#videoElement") as HTMLVideoElement;
  let mediaStream: MediaStream | null = null;

  if (video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = mediaStream;
      return mediaStream;
    } catch (error) {
      console.error(error);
      throw new Error('Unable to access camera');
    }
  } else {
    throw new Error('getUserMedia is not supported');
  }
}

async function main() {
  const videoStream = await createVideoAndGetStream();

  const sessionId = await createSession();
  console.log("Session Created: ", sessionId);

  const response = await startSession(sessionId!, videoStream);
  const responseStream = response!.LivenessResponseStream;
  try {
    const stream = await responseStream;
    // @ts-ignore
    for await (const event of stream) {
      console.log(event);
    }
  } catch (error) {
    console.error(error);
  }
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
  <video autoplay="true" id="videoElement" />
  </div>
`;

main();
