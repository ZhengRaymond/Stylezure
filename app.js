var restify = require('restify');
var builder = require('botbuilder');
var https = require('https');
var request = require('request-promise');

const SENSITIVITY = 0.2;

const FORMAL = 1.0;
const BUSINESS_CASUAL = 0.8;
const SEMI_FORMAL = 0.6;
const CASUAL = 0.4;
const SPORTS_WEAR = 0.2;
const SWIMMING = 0;
const EVENT_INDEX = {
  funeral: [ FORMAL ],
  court: [ FORMAL ],
  "court hearing": [ FORMAL ],

  church: [ BUSINESS_CASUAL, FORMAL ],
  wedding: [ BUSINESS_CASUAL, FORMAL ],

  interview: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  concert: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  ballroom: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  work: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  meeting: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  conference: [ SEMI_FORMAL, BUSINESS_CASUAL ],
  "tech talk": [ SEMI_FORMAL ],
  tech: [ SEMI_FORMAL ],

  bar: [ CASUAL, SEMI_FORMAL ],
  club: [ CASUAL, SEMI_FORMAL ],
  "night club": [ CASUAL, SEMI_FORMAL ],
  dance: [ CASUAL, SEMI_FORMAL ],
  school: [ CASUAL, SEMI_FORMAL ],
  "coffee shop": [ CASUAL, SEMI_FORMAL ],
  cafe: [ CASUAL, SEMI_FORMAL ],
  date: [ CASUAL, SEMI_FORMAL ],
  "coffee date": [ CASUAL, SEMI_FORMAL ],
  class: [ CASUAL, SEMI_FORMAL ],
  "doctor's appointment": [ SPORTS_WEAR, CASUAL, SEMI_FORMAL ],
  "doctors appointment": [ SPORTS_WEAR, CASUAL, SEMI_FORMAL ],
  party: [ SPORTS_WEAR, CASUAL, SEMI_FORMAL ],
  bbq: [ SPORTS_WEAR, CASUAL, SEMI_FORMAL ],
  oktoberfest: [ CASUAL ],
  hackathon: [ CASUAL ],
  "family dinner": [ CASUAL ],
  "aunt's house": [ CASUAL ],
  sleepover: [ CASUAL ],

  "soccer game": [ SPORTS_WEAR, CASUAL ],
  "baseball game": [ SPORTS_WEAR, CASUAL ],
  "football game": [ SPORTS_WEAR, CASUAL ],
  "basketball game": [ SPORTS_WEAR, CASUAL ],
  hiking: [ SPORTS_WEAR ],
  yoga: [ SPORTS_WEAR ],
  gym: [ SPORTS_WEAR, SWIMMING ],
  marathon: [ SPORTS_WEAR ],
  triathlon: [ SPORTS_WEAR ],

  "pool party": [ SWIMMING ],
  "water park": [ SWIMMING ]
}

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    stateEndpoint: process.env.BotStateEndpoint,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

const uri = "eastus2.api.cognitive.microsoft.com";
const path = '/text/analytics/v2.0/keyPhrases';
const full_uri = "https://eastus2.api.cognitive.microsoft.com/text/analytics/v2.0/keyPhrases";

// var luisAppId = process.env.LuisAppId;
// var luisAPIKey = process.env.LuisAPIKey;
// var luisAPIHostName = process.env.LuisAPIHostName || 'eastus2.api.cognitive.microsoft.com';
// const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;
// var recognizer = new builder.LuisRecognizer(LuisModelUrl);
// var intents = new builder.IntentDialog({ recognizers: [recognizer] })
var latestMe = null;
var correctKey = null;

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
  var content;
  if (session.message.attachments && session.message.attachments.length > 0 && session.message.attachments[0].contentType === 'image/jpeg') {
    content = session.message.attachments[0].contentUrl;
    latestMe = 1;//CALL_WATSON(content);
    session.send("Hmmm... let me see...");
  }
  else {
    content =  { 'documents': [
      { 'id': '1', 'language': 'en', 'text': session.message.text },
    ]}
    let req = request({
      method: 'POST',
      uri: full_uri,
      body: JSON.stringify(content),
      headers : {
        'Ocp-Apim-Subscription-Key' : process.env.MicrosoftTextAnalyticsKey,
      }
    }).then((data) => JSON.parse(data))
      .then((data) => {
        if (!data.documents || data.documents.length === 0 || data.documents[0].keyPhrases.length === 0) {
          session.send("I'm sorry, I didn't get that.");
        }
        else {
          session.send("Let me help you prepare for your %s", data.documents[0].keyPhrases)
        }
        correctKey = 1; // get formality index of event.
      })
      .catch((err) => console.log(err));
  }

  if (latestMe && correctKey) {
    if (latestMe.formality - correctKey.formality > SENSITIVITY) {
      session.send('I feel you may be overdressing this a bit. Maybe try toning it down a little?');
    }
    else if (latestMe.formality - correctKey.formality < -1 * SENSITIVITY) {
      session.send('I feel you may be overdressing this a bit. Maybe try toning it down a little?');
    }
    else if (latestMe.unsync) {
      for (var clothing in latestMe.unsync) {
        session.send(`Pretty good, but I feel you should try switching out your ${clothing} for something more ${latestMe.unsync[key]}`)
      }
    }
  }
});
