const commands = {
  "auto":    '{"action":"setState","value":"auto"}',
  "wind":    '{"action":"setState","value":"wind"}',
  "route":   '{"action":"setState","value":"route"}',
  "standby": '{"action":"setState","value":"standby"}',
  "+1":      '{"action":"changeHeadingByKey","value":"+1"}',
  "+10":     '{"action":"changeHeadingByKey","value":"+10"}',
  "-1":      '{"action":"changeHeadingByKey","value":"-1"}',
  "-10":     '{"action":"changeHeadingByKey","value":"-10"}',
  "tackToPort":   '{"action":"tackTo","value":"port"}',
  "tackToStarboard":   '{"action":"tackTo","value":"starboard"}'
}

var touchEnd = function(event) {
  event.currentTarget.onclick();
  event.preventDefault(true);
}

var sendCommand = function(cmd) {
  document.getElementById("errorIcon").style.visibility = 'hidden';
  document.getElementById("sendIcon").style.visibility = 'visible';
  window.fetch('/plugins/raymarineautopilot/command', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: commands[cmd],
  }).then(function(response) {
      setTimeout(function(){document.getElementById("sendIcon").style.visibility = 'hidden';}, 800);
      if (response.status !== 200) {
        document.getElementById("errorIcon").style.visibility = 'visible';
        if (response.status === 401) {
          alert('You must be authenticated to send commands !')
        } else {
          document.getElementById("errorIcon").style.visibility = 'visible';
          alert('[' + response.status + ']' + response.text)
        }
      }
    }, function(status) {
        document.getElementById("sendIcon").style.visibility = 'hidden';
        document.getElementById("errorIcon").style.visibility = 'visible';
        alert(status.message)
    }
  );
}

var ws = new WebSocket((window.location.protocol === 'https:' ? 'wss' : 'ws') + "://" + window.location.host + "/signalk/v1/stream?subscribe=none");

ws.onopen = function() {
  var subscriptionObject = {
    "context": "vessels.self",
    "subscribe": [{
      "path": "navigation.courseOverGroundTrue",
      "period": 5000,
      "format": "delta",
      "minPeriod": 1000
    }]
  };
  var subscriptionMessage = JSON.stringify(subscriptionObject);
  console.log("Sending subscription:" + subscriptionMessage)
  ws.send(subscriptionMessage);
}

ws.onclose = function() {
  console.log("ws close");
}

ws.onmessage = function(event) {
  var jsonData = JSON.parse(event.data)
  var timestamp = new Date(jsonData.updates[0].timestamp)
  var value = jsonData.updates[0].values[0].value;
  dataDiv.innerHTML = value + '<BR/>' + timestamp.toDateString() + '<BR/>' + timestamp.toTimeString();
//  console.log(value)
}
