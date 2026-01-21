const mediasoup = require('mediasoup');

const ANNOUNCED_IPS = process.env.ANNOUNCED_IPS.split(",");
let listenIps = [];
for (let i in ANNOUNCED_IPS) {
  listenIps.push({
    ip: "0.0.0.0",
    announcedIp: ANNOUNCED_IPS[i]
  })
}

/**
 * 
 * @param {import("mediasoup/types").Router} router 
 * @returns 
 */
async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    enableSctp: true,
    numSctpStreams: { OS: 1024, MIS: 1024 },
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
  };
}


/**
 * 
 * @returns {{router: import("mediasoup/types").Router, worker: import("mediasoup/types").Worker}}
 */
const createWorkerAndRouter = async () => {
  // 1. Create a Worker
  const worker = await mediasoup.createWorker({
    logLevel: 'warn', // Change to 'debug' for detailed logs
    rtcMinPort: process.env.RTC_MIN_PORT ? process.env.RTC_MIN_PORT : 40000,
    rtcMaxPort: process.env.RTC_MAX_PORT ? process.env.RTC_MAX_PORT : 40500
  });


  worker.on('died', () => {
    console.error('mediasoup Worker died, exiting...');
    process.exit(1);
  });

  // 2. Create a Router
  const mediaCodecs = [
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000
      }
    },
    {
      kind: 'video',
      mimeType: "video/VP9",
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      }
    },
    {
      kind: 'video',
      mimeType: 'video/AV1',
      clockRate: 90000,
      parameters: {},
      rtcpFeedback: [
        { type: 'nack' },
        { type: 'nack', parameter: 'pli' },
        { type: 'ccm', parameter: 'fir' },
        { type: 'goog-remb' },
        { type: 'transport-cc' },
      ],
    },
    {
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1
      },
      rtcpFeedback: [
        { type: 'nack' },
        { type: 'nack', parameter: 'pli' },
        { type: 'ccm', parameter: 'fir' },
        { type: 'goog-remb' },
        { type: 'transport-cc' }
      ]
    },
    {
      mimeType: "audio/opus",
      kind: "audio",
      clockRate: 48000,
      channels: 2
    },
  ];

  const router = await worker.createRouter({ mediaCodecs });


  console.log('mediasoup Worker and Router initialized.');

  return { router, worker }
};

module.exports = { createWebRtcTransport, createWorkerAndRouter }