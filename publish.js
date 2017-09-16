var zipFolder = require('zip-folder');
var path = require('path');
var fs = require('fs');
var request = require('request');

var rootFolder = path.resolve('.');
var zipPath = path.resolve(rootFolder, '../First-Bot-Test-2.zip');
var kuduApi = 'https://First-Bot-Test-2.scm.azurewebsites.net/api/zip/site/wwwroot';
var userName = '$First-Bot-Test-2';
var password = 'kBtxwlTmQrroosShKRz0A8nYYSSmJ6spHbqHovJtg3P5cMLgNgt3cTTmlcg7';

function uploadZip(callback) {
  fs.createReadStream(zipPath).pipe(request.put(kuduApi, {
    auth: {
      username: userName,
      password: password,
      sendImmediately: true
    },
    headers: {
      "Content-Type": "applicaton/zip"
    }
  }))
  .on('response', function(resp){
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      fs.unlink(zipPath);
      callback(null);
    } else if (resp.statusCode >= 400) {
      callback(resp);
    }
  })
  .on('error', function(err) {
    callback(err)
  });
}

function publish(callback) {
  zipFolder(rootFolder, zipPath, function(err) {
    if (!err) {
      uploadZip(callback);
    } else {
      callback(err);
    }
  })
}

publish(function(err) {
  if (!err) {
    console.log('First-Bot-Test-2 publish');
  } else {
    console.error('failed to publish First-Bot-Test-2', err);
  }
});