const startBtn = document.getElementById("start") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const output = document.getElementById("output") as HTMLTextAreaElement;


const DEEPGRAM_API_KEY = "YOUR_DEEPGRAM_API_KEY";


let socket: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;

let finalTranscript = "";

startBtn.onclick = async () => {
  output.value = "🎙 Connecting...\n";
  finalTranscript = "";

  startBtn.disabled = true;
  stopBtn.disabled = false;

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioContext = new AudioContext({ sampleRate: 16000 });
  source = audioContext.createMediaStreamSource(stream);
  processor = audioContext.createScriptProcessor(1024, 1, 1); // FAST

  socket = new WebSocket(
    "wss://api.deepgram.com/v1/listen" +
      "?model=nova-2" +
      "&language=en" +
      "&encoding=linear16" +
      "&sample_rate=16000" +
      "&channels=1" +
      "&punctuate=true" +
      "&smart_format=true" +
      "&interim_results=true" +
      "&endpointing=100",
    ["token", DEEPGRAM_API_KEY]
  );

  socket.onopen = () => {
    output.value = "🎙 Listening...\n";
    source!.connect(processor!);
    processor!.connect(audioContext!.destination);

    processor!.onaudioprocess = (e) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      socket.send(float32ToPCM16(input));
    };
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const transcript = data?.channel?.alternatives?.[0]?.transcript;

    if (!transcript) return;

    if (data.is_final) {
      finalTranscript += transcript + " ";
      output.value = finalTranscript;
    } else {
    
      output.value = finalTranscript + transcript;
    }
  };

  socket.onerror = () => {
    output.value += "\n❌ Connection error";
  };
};

stopBtn.onclick = () => {
  if (processor) processor.disconnect();
  if (source) source.disconnect();
  if (audioContext) audioContext.close();
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (socket) socket.close();

  startBtn.disabled = false;
  stopBtn.disabled = true;
};

function float32ToPCM16(buffer: Float32Array) {
  const pcm16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    pcm16[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7fff;
  }
  return pcm16.buffer;
}
