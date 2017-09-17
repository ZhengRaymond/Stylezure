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
  UNDERDRESSED: [
    "Hmmm... a bit dreary, let's add some formality!",
    "The outfit seems a bit too... casual. Let's try something more formal!",
    "Perhaps we should reconsider your outfit... something more... proper."
  ],
  OVERDRESSED: [
    'I feel you may be overdressing this a bit. Maybe try toning it down a little?',
    "That *is* very nice indeed... but perhaps a bit too fancy? Let's try something else.",
    "Perhaps overdoing the occasion? Let's try something a little subtler."
  ],
  PERFECT: [
    'You look splendid sir!',
    'Fantastic choice, I love the outfit...',
    'Good taste, monsieur.'
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
const uri = "eastus2.api.cognitive.microsoft.com";
const path = '/text/analytics/v2.0/keyPhrases';
const full_uri = "https://eastus2.api.cognitive.microsoft.com/text/analytics/v2.0/keyPhrases";
const api_key = "ef20984fb589669107f00b69fe334de9ebdf8590";

var myFormality = null;
var correctFormality = null;

var google_classes = [];
var watson_classes = [];

const get_google_classes = (url_or_filename) => {
  var req = {
    source: {
      imageUri: url_or_filename
    }
  };

  cloudinary.uploader.upload("filename.jpg", function(result) {
    return vision.labelDetection({source:{imageUri: result.url}}).then((results) => {
       console.log(results[0].labelAnnotations);
       const labels = results[0].labelAnnotations;
       var vals_to_return = [];

      labels.forEach((label) => {
         google_classes.push(label.description);
       });
       console.log("GOOG", google_classes);

     }).catch((err) => console.error(err));
  });
}

// function get_watson_classes(url) {
//   var visual_recognition = watson.visual_recognition({
//     api_key: api_key,
//     version: 'v3',
//     version_date: '2016-05-20'
//   });
//
//   // request(url)
//   //   .then((image) => {
//   //     request.post(`https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classify&api_key=${api_key}?version=2016-05-20`, (err, resp, body) => {
//   //       if (err) {
//   //         console.log('Error!');
//   //       } else {
//   //         console.log('URL: ' + body);
//   //       }
//   //     });
//   //     var form = req.form();
//   //     form.append('images_file', image, {
//   //         filename: 'myfile.jpg',
//   //         contentType: 'images/jpeg'
//   //     });
//       // request({
//     //     method: "POST",
//     //     uri: "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classify",
//     //     form: {
//     //         images_file: image
//     //     },
//     //     params: {
//     //       api_key: api_key,
//     //       version: '2016-05-20'
//     //     }
//     //   }).then((data) => console.log("contact success:", data))
//     //     .catch((err) => console.log("contact ERROR:", err));
//     // })
//     // .catch((err) => console.error(err));
//     // return;
//
//     return request(url)
//       .then((data) => {
//       var params = {
//         images_file: data
//       }
//
//       return visual_recognition.classify(params, function(err, res) {
//         if (err) {
//           return console.log(err);
//         }
//
//         console.log(JSON.stringify(res, null, 2));
//
//         const classes = res.images[0].classifiers[0].classes;
//
//         classes.forEach((label) => watson_classes.push(label.class));
//       });
//     })
//     .catch((err) => console.error(err));
// }

function calculate_watson(url, event_score) {
  let promises = [ get_google_classes(url) ];
  return Promise.all(promises).then(() => {
    var user_clothing = _.union(google_classes, watson_classes);
    user_clothing = _.intersection(user_clothing, Object.keys(all_clothes));

    user_score = 0;
    user_clothing.forEach((clothing) => user_score += all_clothes[clothing].formality);
    user_score /= user_clothing.length;

    var invalid_clothes = [];

    user_clothing.forEach((clothing) => {
      if(Math.abs(event_score - all_clothes[clothing].formality) >= 0.1){
        invalid_clothes.push({
          invalid_cloth: clothing,
          replacements: Object.keys(all_clothes).filter((cloth) => (all_clothes[cloth].formality === event_score && all_clothes[cloth].category === all_clothes[clothing].category))
        });
      }
    })

    return { invalid_clothes, event_score, user_score };
  });
}
<<<<<<< HEAD
// function get_google_classes(url) {
//   request(url)
//     .then((image) => {
//       return vision.labelDetection(image).then((results) => {
//         const labels = results[0].labelAnnotations;
//         var vals_to_return = [];
//
//         labels.forEach((label) => {
//           google_classes.push(label.description);
//         });
//       });
//     })
//     .catch((err) => console.error(err));
// }
//
// function get_watson_classes(url) {
//   var visual_recognition = watson.visual_recognition({
//     api_key: api_key,
//     version: 'v3',
//     version_date: '2016-05-20'
//   });
//
//   console.log(url);
//
//   // request(url)
//   //   .then((image) => {
//   //     request.post(`https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classify&api_key=${api_key}?version=2016-05-20`, (err, resp, body) => {
//   //       if (err) {
//   //         console.log('Error!');
//   //       } else {
//   //         console.log('URL: ' + body);
//   //       }
//   //     });
//   //     var form = req.form();
//   //     form.append('images_file', image, {
//   //         filename: 'myfile.jpg',
//   //         contentType: 'images/jpeg'
//   //     });
//       // request({
//     //     method: "POST",
//     //     uri: "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classify",
//     //     form: {
//     //         images_file: image
//     //     },
//     //     params: {
//     //       api_key: api_key,
//     //       version: '2016-05-20'
//     //     }
//     //   }).then((data) => console.log("contact success:", data))
//     //     .catch((err) => console.log("contact ERROR:", err));
//     // })
//     // .catch((err) => console.error(err));
//     // return;
//
//     request(url)
//       .then((data) => {
//
//       var params = {
//         images_file: data
//       }
//
//       return visual_recognition.classify(params, function(err, res) {
//         if (err) {
//           return console.log(err);
//         }
//
//         console.log(JSON.stringify(res, null, 2));
//
//         const classes = res.images[0].classifiers[0].classes;
//
//         classes.forEach((label) => watson_classes.push(label.class));
//       });
//     })
//     .catch((err) => console.error(err));
// }
//
// function calculate_watson(url, event_score) {
//   let promises = [ get_google_classes(url), get_watson_classes(url) ];
//
//   return Promise.all(promises).then(() => {
//     var user_clothing = _.union(google_classes, watson_classes);
//     user_clothing = _.intersection(user_clothing, Object.keys(all_clothes));
//
//     user_score = 0;
//     user_clothing.forEach((clothing) => user_score += all_clothes[clothing].formality);
//     user_score /= user_clothing.length;
//
//     var invalid_clothes = [];
//
//     user_clothing.forEach((clothing) => {
//       if(Math.abs(event_score - all_clothes[clothing].formality) >= 0.1){
//         invalid_clothes.push({
//           invalid_cloth: clothing,
//           replacements: Object.keys(all_clothes).filter((cloth) => (all_clothes[cloth].formality === event_score && all_clothes[cloth].category === all_clothes[clothing].category))
//         });
//       }
//     })
//
//     return { invalid_clothes, event_score, user_score };
//   });
// }
=======
>>>>>>> 36c2fe3... added node_modules

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

// var luisAppId = process.env.LuisAppId;
// var luisAPIKey = process.env.LuisAPIKey;
// var luisAPIHostName = process.env.LuisAPIHostName || 'eastus2.api.cognitive.microsoft.com';
// const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;
// var recognizer = new builder.LuisRecognizer(LuisModelUrl);
// var intents = new builder.IntentDialog({ recognizers: [recognizer] })

function fetch_amazon(session, clothing) {
  aws_client.itemSearch({
    searchIndex: "FashionMen",
    responseGroup: "ItemAttributes, Images",
    keywords: clothing
  })
    .then((data) => {
      for (var i = 0; i < data.length; i++) {
        if (i === 2) break;
        var text = `[details](${data[i].DetailPageURL}) `;
        var attachments = [{
          contentType: 'image/jpeg',
          contentUrl: data[i].SmallImage[0].URL[0],
          name: 'item_image'
        }];
        session.send({ text, attachments });
      }
    })
    .catch((err) => console.error(err));
}

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
  var content;
  if (session.message.attachments && session.message.attachments.length > 0 && session.message.attachments[0].contentType === 'image/jpeg') {
    if (correctFormality) {
      content = session.message.attachments[0].contentUrl;
<<<<<<< HEAD
      request(content).pipe(fs.createWriteStream('filename.jpg')).on('close', () => {
        calculate_watson('filename.jpg', correctFormality)
          .then((data) => console.log(JSON.stringify(data, undefined, 2)))
          .catch((err) => console.error(err));
      });
=======
      session.send(content);
      session.send(get_watson_classes(content));
      // calculate_watson(content, correctFormality)
      //   .then((data) => console.log(JSON.stringify(data, undefined, 2)))
      //   .catch((err) => console.error(err));
>>>>>>> 36c2fe3... added node_modules
      session.send("Hmmm... let me see...");
    }
    else {
      session.send("Sir, I can't pick clothes if I know not the occasion!");
    }
      // {
      //   "invalid_clothes": [
      //     {
      //       "invalid_cloth": "blazer",
      //       "replacements": [
      //         "hoodie",
      //         "trench coat",
      //         "hood",
      //         "sweatshirt"
      //       ]
      //     }
      //   ],
      //   "event_score": 0.2,
      //   "user_score": 0.39999999999999997
      // }
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
          session.send("Let me help you prepare for your %s", event)
          correctFormality = event;
        }
      })
      .catch((err) => console.error(err));
  }
  if (myFormality && correctFormality) {
    if (myFormality.value - correctFormality.value > SENSITIVITY) {
      session.send(VOICES.OVERDRESSED[Math.floor(Math.random()*3)]);
    }
    else if (myFormality.value - correctFormality.value < -1 * SENSITIVITY) {
      session.send(VOICES.UNDERDRESSED[Math.floor(Math.random()*3)]);
    }
    else if (myFormality.discord) {
      for (var clothing in myFormality.discord) {
        session.send(`Pretty good, but I feel you should try switching out your ${clothing} for something more ${latestMe.unsync[key]}. Here are some ${clothing} suggestions:`)
      }
    }
    else {
      session.send(VOICES.PERFECT[Math.floor(Math.random()*3)]);
    }
  }
});
