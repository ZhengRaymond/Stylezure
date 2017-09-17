const Vision = require('@google-cloud/vision');
const vision = Vision();
const _ = require('lodash');
const all_clothes = require('./all_clothes.json');
const express = require('require');
const app = express();
const port = process.env.PORT || 3000;


var api_key = "ef20984fb589669107f00b69fe334de9ebdf8590";
var watson = require('watson-developer-cloud');
var fs = require('fs');

var google_classes = [];
var watson_classes = [];

const get_google_classes = (url_or_filename) => {
  var request = {
    source: {
      filename: url_or_filename
    }
  };

  return vision.labelDetection(request).then((results) => {
    const labels = results[0].labelAnnotations;
    var vals_to_return = [];

    labels.forEach((label) => {
      google_classes.push(label.description);
    });
  });
}

const get_watson_classes = (url_or_filename) => {
  var visual_recognition = watson.visual_recognition({
    api_key: api_key,
    version: 'v3',
    version_date: '2016-05-20'
  });

  var params = {
    images_file: fs.createReadStream(url_or_filename)
  };

  return visual_recognition.classify(params, function(err, res) {
    if (err) {
      return console.log(err);
    }

    const classes = res.images[0].classifiers[0].classes;

    classes.forEach((label) => watson_classes.push(label.class));
  });
}

function init(url, event_score) {
  let promises = [ get_google_classes(url), get_watson_classes(url) ];

  Promise.all(promises).then(() => {
    // console.log(google_classes);
    // console.log(watson_classes);
    var user_clothing = _.union(google_classes, watson_classes);
    user_clothing = _.intersection(user_clothing, Object.keys(all_clothes));

    user_score = 0;

    for(var i=0; i<user_clothing.length; ++i) {
      user_score += all_clothes[user_clothing[i]].formality;
    }

    user_score /= user_clothing.length;

    output = {
      event_score,
      user_score,

    };

    invalid_clothes = [];

    for(var i=0; i<user_clothing.length; ++i){
      if(Math.abs(event_score - all_clothes[user_clothing[i]].formality) >= 0.1){
        invalid_clothes.push({
          invalid_cloth: user_clothing[i],
          replacements: Object.keys(all_clothes).filter((cloth) => (all_clothes[cloth].formality === event_score && all_clothes[cloth].category === all_clothes[user_clothing[i]].category))
        });
      }
    }

    console.log(invalid_clothes)
    console.log(user_score);
    return invalid_clothes;
  });
}

// init("https://staticdelivery.nexusmods.com/mods/110/images/thumbnails/17970-1-1338505684.jpg", 0.5);
init("./demo-image.jpg", 0.2);

app.get('/', (req, res) => {
  console.log(req);
  res.status(200);
  return;
  var x = init(req.body);
});


app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
