# Nexmo-Google-Teneo-integration

Before proceeding with the installation notes below, make sure you have a Google project created and correctly authorized on your PC.
For instructions on how to create Google project using Google CLI, see link: https://lobster1234.github.io/2017/05/14/get-started-on-google-cloud-with-cli/

Installation:

0. Open terminal
1. git clone https://github.com/max-schmidt92/Nexmo-Google-Teneo-integration.git
2. npm install (in the same directory where the git clone occurred)
3. Enter Vonage Dashboard (https://dashboard.nexmo.com/), create or use existing application.
You will need to use the credentials below when establishing the .env file. Do not forget to associate a phone number to the project.
4. Create .env file in the directory, the structure of the parameters uses following example data:

TENEO_ENGINE_URL=<URL_TO_TENEO_ENGINE>
LANGUAGE_CODE=en-GB
PORT=3000
GOOGLE_PROJECT_NAME=<PROJECT_NAME>
TTS_RESPONSE_TYPE=google-websocket
AUDIO_FILE_NAME=output.mp3
NEXMO_API_KEY=e3e996XX
NEXMO_API_SECRET=tY3CSDhXXXXXXXX
NEXMO_APPLICATION_ID=8e454ec4-149a-4433-9dc6-XXXXXXXXX
NEXMO_PRIVATE_KEY_PATH=private.key

Notes:
AUDIO_FILE_NAME is only used if "TTS_RESPONSE_TYPE=google-audio-file" is set, otherwise it is not used.

5. Download and launch ngrok from command prompt, run it as follows: ngrok http 3000.
6. Enter the following URL's in the Vonage Application:

![Replace the ngrok URL with your own, as indicated by the red line.](http://puu.sh/FEv5s/faceeee6ef.png)

Replace the ngrok URL with your own, as indicated by the red line.

7. Start the server.js application through your IDE or use npm start.
8. Call the phone number associated with the Vonage project to initiate interactions.
You can add introduction message on row 164-165 for an introduction message, as the call starts with no response from the NodeJS server otherwise by default.
