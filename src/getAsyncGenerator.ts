import {
    ClientSessionInformationEvent,
    LivenessRequestStream,
  } from "@aws-sdk/client-rekognitionstreaming";
  
  function isBlob(obj: unknown): obj is Blob {
    return (obj as Blob).arrayBuffer !== undefined;
  }
  
  function isClientSessionInformationEvent(
    obj: unknown
  ): obj is ClientSessionInformationEvent {
    return (obj as ClientSessionInformationEvent).Challenge !== undefined;
  }
  
  interface EndStreamWithCodeEvent {
    type: string;
    code: number;
  }
  
  function isEndStreamWithCodeEvent(obj: unknown): obj is EndStreamWithCodeEvent {
    return (obj as EndStreamWithCodeEvent).code !== undefined;
  }
  
  export function getAsyncGeneratorFromReadableStream(
    stream: ReadableStream
  ): () => AsyncGenerator<LivenessRequestStream> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let _reader = stream.getReader();
    return async function* () {
      while (true) {
        const { done, value } = (await _reader.read()) as {
          done: boolean;
          value:
            | "stopVideo"
            | Uint8Array
            | ClientSessionInformationEvent
            | EndStreamWithCodeEvent;
        };
        if (done) {
          return;
        }
  
        // Video chunks blobs should be sent as video events
        if (value === "stopVideo") {
          // sending an empty video chunk signals that we have ended sending video
          yield {
            VideoEvent: {
              VideoChunk: new Uint8Array([]),
              TimestampMillis: Date.now(),
            },
          };
        } else if (isBlob(value)) {
          const buffer = await value.arrayBuffer();
          const chunk = new Uint8Array(buffer);
          if (chunk.length > 0) {
            yield {
              VideoEvent: {
                VideoChunk: chunk,
                TimestampMillis: Date.now(),
              },
            };
          }
        } else if (isClientSessionInformationEvent(value)) {
          yield {
            ClientSessionInformationEvent: {
              Challenge: value.Challenge,
            },
          };
        } else if (isEndStreamWithCodeEvent(value)) {
          yield {
            VideoEvent: {
              VideoChunk: new Uint8Array([]),
              // this is a custom type that does not match LivenessRequestStream.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              TimestampMillis: { closeCode: value.code } as any,
            },
          };
        }
      }
    };
  }
  