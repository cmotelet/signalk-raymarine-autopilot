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
      setTimeout(() => {document.getElementById("sendIcon").style.visibility = 'hidden';}, 800);
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
  reconnect = true;
  wsConnect();
}

var ws = null;
var handleMessageStatus = 'undefined';
var reconnect = true;

var wsConnect = function() {
  if (ws === null) {
    try {
      document.getElementById("powerIcon").style.visibility = 'hidden';
      reconnect = true;
      ws = new WebSocket((window.location.protocol === 'https:' ? 'wss' : 'ws') + "://" + window.location.host + "/signalk/v1/stream?subscribe=none");

      ws.onopen = function() {
        var subscriptionObject = {
          "context": "vessels.self",
          "subscribe": [{
            "path": "steering.autopilot.state",
//          "period": 5000,
            "format": "delta",
            "minPeriod": 900
          }]
        };
        var subscriptionMessage = JSON.stringify(subscriptionObject);
        console.log("Sending subscription:" + subscriptionMessage)
        ws.send(subscriptionMessage);
        handleMessageStatusTimeout = setTimeout(() => {setMessageStatus('---')}, 3000);
      }

      ws.onclose = function() {
        console.log("ws close");
        ws = null;
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, 2000);
        }
      }

      ws.onerror = function(error) {
        console.log("ws error:" + error);
        ws = null;
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, 2000);
        }
      }

      ws.onmessage = function(event) {
        document.getElementById("receiveIcon").style.visibility = 'visible';
        setTimeout(() => {document.getElementById("receiveIcon").style.visibility = 'hidden';}, 500);
        var jsonData = JSON.parse(event.data)
//        var timestamp = new Date(jsonData.updates[0].timestamp)
        if (typeof jsonData.updates === 'object') {
          if (typeof jsonData.updates[0].values === 'object') {
            var value = jsonData.updates[0].values[0].value;
            setMessageStatus(value);
            clearTimeout(handleMessageStatusTimeout);
            handleMessageStatusTimeout = setTimeout(() => {setMessageStatus('---')}, 3000);
          }
        }
      }

    } catch (exception) {
      console.error(exception);
      setTimeout(() => {wsConnect()}, 2000);
    }
  }
}


var setMessageStatus = function(value) {
  dataDiv.innerHTML = value || '???';
}

var wsClose = function() {
  reconnect = false;
  document.getElementById("powerIcon").style.visibility = 'visible';
  if (ws !== null) {
    ws.close();
  }
}
