var restify = require('restify');
var builder = require('botbuilder');
var request = require('request-promise');
var amazon = require('amazon-product-api');
const Vision = require('@google-cloud/vision');
const vision = Vision();
const _ = require('lodash');
const all_clothes = require('./all_clothes.json');
var watson = require('watson-developer-cloud');
var fs = require('fs');
var cloudinary = require('cloudinary');

cloudinary.config({
  cloud_name: 'stylezure',
  api_key: '344882863937558',
  api_secret: 'hMCXJ2IgSiGpW_6ya-SqYovmDVA'
});

var aws_client = amazon.createClient({
  awsId: "AKIAJMBOUNJREELMPV3Q",
  awsSecret: "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",
  awsTag: "stylezure-20"
});

const SENSITIVITY = 0.2;

const VOICES = {
  HELPING: [
    "Allow me to help you prepare for the %s",
    "I have *just* the idea!",
    "I can advise well of this situation..."
  ],
  UNDERDRESSED: [
    "Hmmm... a bit too casual, let's add some formality!",
    "The outfit seems a bit too... casual. Let's try something more formal!",
    "Perhaps we should reconsider your outfit... something more... formal."
  ],
  OVERDRESSED: [
    'I feel you may be overdressing a bit. Shall we try toning it down a little?',
    "That *is* very nice indeed... but perhaps a bit too fancy? Let's try something else.",
    "Perhaps overdoing the occasion? Let's try something a little subtler."
  ],
  PERFECT: [
    'You look splendid sir!',
    'Fantastic choice, I love the outfit...',
    'Good taste, sir.'
  ]
}

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

  interview: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  concert: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  ballroom: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  work: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  meeting: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  conference: [ CASUAL, SEMI_FORMAL, BUSINESS_CASUAL ],
  "tech talk": [ CASUAL, SEMI_FORMAL ],
  tech: [ CASUAL, SEMI_FORMAL ],

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
  gym: [ SWIMMING, SPORTS_WEAR ],
  marathon: [ SPORTS_WEAR ],
  triathlon: [ SPORTS_WEAR ],

  "pool party": [ SWIMMING ],
  "water park": [ SWIMMING ]
}
const uri = "eastus2.api.cognitive.microsoft.com";
const path = '/text/analytics/v2.0/keyPhrases';
const full_uri = "https://eastus2.api.cognitive.microsoft.com/text/analytics/v2.0/keyPhrases";
const api_key = "ef20984fb589669107f00b69fe334de9ebdf8590";

var myFormality = null;
var correctFormality = null;

var google_classes = [];
var watson_classes = [];

function within(arr, val) {
  var len = arr.length;
  var smallest = arr[0];
  var largest = arr[len - 1];
  if (smallest - val >= 0.19) return -1;
  else if (largest - val <= -0.19) return 1;
  return 0;
}

const get_google_classes = (url) => {
  return vision.labelDetection({source:{imageUri: url}}).then((results) => {
    const labels = results[0].labelAnnotations;
    var vals_to_return = [];
    labels.forEach((label) => {
      if (label.score > 0.5) {
        google_classes.push(label.description);
      }
    });

   }).catch((err) => console.error(err));
}

function get_watson_classes(url) {
  var visual_recognition = watson.visual_recognition({
    api_key: api_key,
    version: 'v3',
    version_date: '2016-05-20'
  });

  var params = {
    url: url
  }

  return visual_recognition.classify(params, function(err, res) {
    if (err) {
      return console.error(err);
    }
    const classes = res.images[0].classifiers[0].classes;

    classes.forEach((label) => {
      if (label.score > 0.7) {
        watson_classes.push(label.class)
      }
    });
  });
}


function calculate_watson(url, event_score) {
  let promises = [ get_google_classes(url), get_watson_classes(url) ];
  return Promise.all(promises).then(() => {
    var user_clothing = _.union(google_classes, watson_classes);
    user_clothing = _.intersection(user_clothing, Object.keys(all_clothes));

    user_score = 0;
    user_clothing.forEach((clothing) => user_score += all_clothes[clothing].formality);
    user_score /= user_clothing.length;

    var invalid_clothes = [];

    user_clothing.forEach((clothing) => {

      // if(Math.abs(event_score - all_clothes[clothing].formality) >= 0.1){
      if(within(event_score, all_clothes[clothing].formality) !== 0) {
        invalid_clothes.push({
          invalid_cloth: clothing,
          replacements: Object.keys(all_clothes).filter((cloth) => {
            return event_score.indexOf(all_clothes[cloth].formality) !== -1 && all_clothes[cloth].category === all_clothes[clothing].category
          })
        });
      }
    })
    return { invalid_clothes, event_score, user_score };
  });
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

function fetch_amazon(session, invalid_clothes) {
  var clothing = [];
  invalid_clothes.forEach((invalid_cloth) => {
    clothing = [...clothing, ...invalid_cloth.replacements];
  });
  clothing.forEach((cloth) => {
    aws_client.itemSearch({ searchIndex: "FashionMen", responseGroup: "ItemAttributes, Images", keywords: cloth })
      .then((data) => {
        var text = `[${data[0].ItemAttributes[0].Title[0]}](${data[0].DetailPageURL}) `;
        var attachments = [{
          contentType: 'image/jpeg',
          contentUrl: data[0].SmallImage[0].URL[0],
          name: 'item_image'
        }];
        session.send({ text, attachments });
      }).catch((err) => console.error(err));
  })
}

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
  var content;
  var text = session.message.text.toLowerCase();
  if (text.indexOf('hi') !== -1 ||
      text.indexOf('hello') !== -1 ||
      text.indexOf('hey') !== -1 ||
      text.indexOf('greetings') !== -1) {
    setTimeout(() => session.send('Greetings!'), 300);
    return;
  }
  else if (text.indexOf("who") !== -1 ||
          text.indexOf("what") !== -1 ||
          text.indexOf("purpose") !== -1 ){
    setTimeout(() => session.send('I am your Stylezure!'), 300);
    setTimeout(() => session.send("I'm a chatbot built using Microsoft Azure's bot service, Microsoft Text Analysis, and IBM Watson Visual Recognition!"), 1200);
    setTimeout(() => session.send("My job is to help you look the best, anywhere, anytime!"), 2000);
    return;
  }
  else if (text === 'reset') {
    myFormality = null;
    correctFormality = null;
    google_classes = [];
    watson_classes = [];
    return;
  }
  if (session.message.attachments && session.message.attachments.length > 0 && session.message.attachments[0].contentType === 'image/jpeg') {
    if (correctFormality) {
      content = session.message.attachments[0].contentUrl;
      request(content).pipe(fs.createWriteStream('filename.jpg')).on('close', () => {
        cloudinary.uploader.upload("filename.jpg", function(result) {
          calculate_watson(result.url, correctFormality)
            .then((data) => {
              myFormality = data;
            })
            .catch((err) => console.error(err));
        });
      });
      session.send("Hmmm... let me see...");
    }
    else {
      session.send("Sir, I can't pick clothes if I know not the occasion!");
    }
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
          let event = data.documents[0].keyPhrases;
          correctFormality = EVENT_INDEX[event];
          session.send(VOICES.HELPING[Math.floor(Math.random()*3)], event)
          setTimeout(() => session.send("Show me your choice of outfit please."), 1500);
        }
      })
      .catch((err) => console.error(err));
  }
  setTimeout(() => {
    if (myFormality && correctFormality) {
      var score = within(myFormality.event_score, myFormality.user_score);
      if (score === 1) {
        session.send(VOICES.OVERDRESSED[Math.floor(Math.random()*3)]);
        setTimeout(() => session.send("May I suggest some of these?"), 1000);
        setTimeout(() => fetch_amazon(session, myFormality.invalid_clothes), 2000);
      }
      else if (score === -1) {
        session.send(VOICES.UNDERDRESSED[Math.floor(Math.random()*3)]);
        setTimeout(() => session.send("May I suggest some of these?"), 1000);
        setTimeout(() => fetch_amazon(session, myFormality.invalid_clothes), 2000);
      }
      else if (myFormality.discord) {
        for (var clothing in myFormality.discord) {
          session.send(`Pretty good, but I feel you should try switching out your ${clothing} for something more ${latestMe.unsync[key]}. Here are some ${clothing} suggestions:`)
        }
      }
      else {
        session.send(VOICES.PERFECT[Math.floor(Math.random()*3)]);
        myFormality = null;
        correctFormality = null;
        google_classes = [];
        watson_classes = [];
      }
    }
  }, 3000);
});
