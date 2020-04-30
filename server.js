'use strict';

/**
 * Constants - Libraries
 * List of constants showcasing libraries used
 */
const dotenv = require('dotenv');
dotenv.config();
const {
    TENEO_ENGINE_URL,
    LANGUAGE_CODE,
    PORT,
    GOOGLE_PROJECT_NAME,
    TTS_RESPONSE_TYPE,
    AUDIO_FILE_NAME,
    NEXMO_API_KEY,
    NEXMO_API_SECRET,
    NEXMO_APPLICATION_ID,
    NEXMO_PRIVATE_KEY_PATH
} = process.env;

/**
 * Constants - Configurations
 * List of configuration constants. See comments below for more information.
 */
// Libraries instantsiated as constants
const fs = require('fs');
const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const expressWs = require('express-ws')(app);
const { Readable } = require('stream');
const Nexmo = require('nexmo');
const TIE = require('@artificialsolutions/tie-api-client');
const striptags = require('striptags');

// Parameterised constants
const language_code = LANGUAGE_CODE;
const port = PORT;
const audio_file_location = AUDIO_FILE_NAME;

/**
 * Nexmo constant contains credentials necessary to authenticate to Nexmo services.
 * For more information, please visit the following link: https://github.com/Nexmo/nexmo-node
 */
const nexmo = new Nexmo({
    apiKey: NEXMO_API_KEY,
    apiSecret: NEXMO_API_SECRET,
    applicationId: NEXMO_APPLICATION_ID,
    privateKey: NEXMO_PRIVATE_KEY_PATH
}, {debug: false}); // Leave debug: true to showcase all information.

/**
 * Google TTS function. When the data has been retrieved from Google cloud, processing from text to speech is started.
 */
const stt = require('@google-cloud/speech');
const google_stt_client = new stt.SpeechClient({
    projectId: GOOGLE_PROJECT_NAME,
    keyFilename: GOOGLE_PROJECT_NAME + '.json'
});

/**
 * Separate configuration file for Google cloud TTS.
 * NOTE: You _have_ to keep a seperate variable for projectId and KeyFileName, otherwise there will be an exception.
 * You can allow Google TTS and STT in the same project for both variables.
 * @type {{keyFilename: string, projectId: string}}
 */
const tts_config = {
    projectId: GOOGLE_PROJECT_NAME,
    keyFilename: GOOGLE_PROJECT_NAME + '.json'
};
const tts = require('@google-cloud/text-to-speech');
const google_tts_client = new tts.TextToSpeechClient(tts_config);

/**
 * Variables
 */
// Change between "google" or "nexmo"
var tts_response_type = TTS_RESPONSE_TYPE;
// Global variable to keep track of the caller
var CALL_UUID = null;
// Global variable holding detected ngrok hostname
var ngrok_hostname = null;
var endCall = false;

/**
 * Variables to connect with Teneo session.
 */
// Insert any deployed Teneo URL here
var teneoEngineUrl = TENEO_ENGINE_URL;// 'https://teneo-demos-fusion.presales.artificial-solutions.com/circleklocaldktoberemoved/';
var sessionUniqueID = null;
var streamResponse = null;

/**
 * Server configuration
 */
app.use(bodyParser.json());
// Required to host and stream audio file to Nexmo when read out, if the option is selected.
app.use(express.static('public'));
app.use(express.static('files'));
const path = require('path');
app.use('/', express.static(path.join(__dirname, '')));
/**
 * GET response for Nexmo to retrieve the locally saved Google TTS audio file.
 */
app.get('/' + audio_file_location, function(req, res){
    res.sendFile(`${__dirname}/` + audio_file_location);
});

/**
 * POST response for the default events parameter
 */
app.post('/webhooks/events', (req, res) => {
    res.sendStatus(200);
});

/**
 * GET response for the default answer parameter. Required to initialise the conversation with caller.
 */
app.get('/webhooks/answer', (req, res) => {

    ngrok_hostname = req.hostname;

    let nccoResponse = [
        {
            "action": "connect",
            "bargeIn": true,
            "endpoint": [{
                "type": "websocket",
                "content-type": "audio/l16;rate=16000",
                "uri": 'ws://' + ngrok_hostname + '/socket',
                // The headers parameter will be past in the config variable below.
                "headers": {
                    "language": language_code,
                    "uuid": req.url.split("&uuid=")[1].toString()
                }
            }],
        }
    ];

    res.status(200).json(nccoResponse);
});

/**
 * Websocket communicating with Nexmo and the end-user via the active phone call.
 * CALL_UUID parameter is passed to
 */
app.ws('/socket', (ws, req) => {

    streamResponse = ws;

    // Initialised after answer webhook has started
    ws.on('message', (msg) => {
        // Initiated once as soon as the we
        if (typeof msg === "string") {
            // UUID is captured here.
            let config = JSON.parse(msg);

            if(!CALL_UUID) {
                CALL_UUID = config["uuid"];
            }

            // Introduction message
            //processContent("");

            // Refresh to keep the session alive
            setInterval(function () {
                ws.send("");
            }, 25000);
        }

        // Send the user input as byte array to Google TTS
        else {
            sendStream(msg);
        }
    });

    // Initiated when caller hangs up.
    ws.on('close', () => {
        //recognizeStream.destroy();
    })
});

/**
 * recognizeStream constant encapsulates the Google STT client. It will return the text response based on stream
 * input during runtime from Nexmo.
 */
const recognizeStream = google_stt_client
    .streamingRecognize({
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: language_code
        },
        singleUtterance: false,
        interimResults: false,
        verbose: false
    })
    .on('error', (e)=>{
        console.log(e)
    })
    .on('data', data => {
        processContent(data.results[0].alternatives[0].transcript);
    });

/**
 * sendStream method asynchronously sends bytes to the recognizeStream constant as input
 * @param msg - Bytes sent from Nexmo to Google
 */
async function sendStream(msg) {
    await recognizeStream.write(msg);
}

/**
 * processContent is an asynchronous function to send input and retrieve output from a Teneo instance.
 * After this is completed, Google or Nexmo TTS is initiated.
 * @param transcript Transcripted text from Google
 */
async function processContent(transcript) {
    await TIE.sendInput(teneoEngineUrl, sessionUniqueID, { text: transcript} )
        .then((response) => {
            console.log("Speech-to-text translation output: " + transcript);
            transcript = striptags(response.output.text);
            console.log("Bot response: " + transcript);
            if (response.output.parameters.endCall==="true") {
                console.log('set endcall to true');
                endCall=true;
            }
                return response
            }
        ).then(({sessionId}) => sessionUniqueID = sessionId);
    transcript = transcript.split("||").join("");
    sendTranscriptVoice(transcript);
}

/**
 * sendTranscriptVoice performs Google/Nexmo TTS operation and Nexmo returns the audio back to the end user.
 * @param transcript Message to be sent back to the end user
 */
async function sendTranscriptVoice(transcript) {

    // Google ASR response using audio file to transmit audio
    if(tts_response_type === "google-websocket") {
        await generateAudioForNexmoWebsocket(transcript);
    }

    // Google ASR response using audio file to transmit audio
    else if(tts_response_type === "google-audio-file") {
        await generateGoogleSpeechAudioFromFile(transcript);
    }
}

/**
 * generateGoogleSpeechAudioFromFile method creates audio file using transcripted text from Google STT functionaality.
 * Somehow, no matter the URL utilised for the streaming functionality, nothing is found as a stream.
 * Not even Vonage's own streaming URL's. Works when tested locally in browser, but not for the NodeJS library below.
 * @param transcript - Transcript used to create audio file and
 */
async function generateGoogleSpeechAudioFromFile(transcript) {

    // Performs the text-to-speech request
    const [response_mp3] = await google_tts_client.synthesizeSpeech({
        input: {text: transcript},
        // Select the language and SSML voice gender (optional)
        voice: {languageCode: language_code, ssmlGender: 'FEMALE'},
        // select the type of audio encoding
        audioConfig: {audioEncoding: 'MP3'},
    });

    // Create promise object to allow the file to be created and awaited asynchronously.
    const writeFile = util.promisify(fs.writeFile);

    // Write the binary audio content to a local file
    await writeFile(audio_file_location, response_mp3.audioContent, 'binary');

    // Not functional, Nexmo does not attempt to play the audio (?)
    nexmo.calls.stream.start(CALL_UUID, { stream_url: ['https://' + ngrok_hostname + '/' + audio_file_location], loop: 1, bargeIn: true }, (err, res) => {
        if(err) { console.error(err); }
        else {
            if (endCall) {
                //end the call after speaking the closing message.
                nexmo.calls.update(CALL_UUID,{action:'hangup'},console.log('call ended'))
            }
            console.log();
        }
    });
}

/**
 * generateAudioForNexmoWebsocket method synthezises speech from transcripted text by Google STT to Google TTS.
 * The response is sent back through Nexmo using websockets.
 * @param transcript - Translated text using Google STT
 */
async function generateAudioForNexmoWebsocket(transcript) {

    // Performs the text-to-speech request
    const [response_linear] = await google_tts_client.synthesizeSpeech({
        input: {text: transcript},
        // Select the language and SSML voice gender (optional)
        voice: {languageCode: language_code, ssmlGender: 'FEMALE'},
        // select the type of audio encoding
        audioConfig: {audioEncoding: 'LINEAR16', sampleRateHertz: 16000},
    });

    formatForNexmo(response_linear.audioContent,640).forEach(function(aud) {
        streamResponse.send(aud);
    });
}

/**
 * Constructs the byte array to be written to the Nexmo Websocket, in packets of byteLen length.
 * @param ac Audio response Buffer
 */
function formatForNexmo(ac, byteLen) {

    var totalByteLength = Buffer.byteLength(ac);

    var msgLength = byteLen; // bytes

    var bufQueue=[];

    for (var i=0;i<totalByteLength;i+=msgLength) {
        bufQueue.push(ac.slice(i,i+msgLength));
    }
    return bufQueue;
}

/**
 * Initialise the server after defining the server functions.
 */
app.listen(port, () => console.log(`Server started using port ${port}`));