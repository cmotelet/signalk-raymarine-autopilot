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

var ws = null;
var handlePilotStatusTimeout = null;
var handleHeadindValueTimeout = null;
var handleReceiveTimeout = null;
var connected = false;
var reconnect = true;
const timeoutReconnect = 2000;
const timeoutValue = 2000;
const timeoutBlink = 500;
var pilotStatusDiv = 'undefined';
var headingValueDiv = 'undefined';

var startUpRayRemote = function() {
  pilotStatusDiv = document.getElementById('pilotStatus');
  headingValueDiv = document.getElementById('headingValue');
  setPilotStatus('---');
  setHeadindValue('---');
  setTimeout(() => {
    document.getElementById("receiveIcon").style.visibility = 'hidden';
    document.getElementById("sendIcon").style.visibility = 'hidden';
    document.getElementById("errorIcon").style.visibility = 'hidden';
    document.getElementById("powerIcon").style.visibility = 'hidden';
    document.getElementById("bottomBarIcon").innerHTML = '';
    wsConnect();
  }, 1000);
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
      setTimeout(() => {document.getElementById("sendIcon").style.visibility = 'hidden';}, timeoutBlink);
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

var wsConnect = function() {
  if (ws === null) {
    try {
      document.getElementById("powerIcon").style.visibility = 'hidden';
      reconnect = true;
      ws = new WebSocket((window.location.protocol === 'https:' ? 'wss' : 'ws') + "://" + window.location.host + "/signalk/v1/stream?subscribe=none");

      ws.onopen = function() {
        connected = true;
        var subscriptionObject = {
          "context": "vessels.self",
          "subscribe": [
            {
              "path": "steering.autopilot.state",
              "format": "delta",
              "minPeriod": 900
            },
            {
              "path": "navigation.headingMagnetic",
              "format": "delta",
              "minPeriod": 900
            }
          ]
        };
        var subscriptionMessage = JSON.stringify(subscriptionObject);
//        console.log("Sending subscription:" + subscriptionMessage)
        ws.send(subscriptionMessage);
        handlePilotStatusTimeout = setTimeout(() => {setPilotStatus('---')}, timeoutValue);
        handleHeadindValueTimeout = setTimeout(() => {setHeadindValue('---')}, timeoutValue);
      }

      ws.onclose = function() {
//        console.log("ws close");
        ws = null;
        connected = false;
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, timeoutReconnect);
        }
      }

      ws.onerror = function() {
        console.log("ws error");
        ws = null;
        connected = false;
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, timeoutReconnect);
        }
      }

      ws.onmessage = function(event) {
        document.getElementById("receiveIcon").style.visibility = 'visible';
        clearTimeout(handleReceiveTimeout);
        handleReceiveTimeout = setTimeout(() => {document.getElementById("receiveIcon").style.visibility = 'hidden';}, timeoutBlink);
        var jsonData = JSON.parse(event.data)
        dispatchMessages(jsonData);
      }

    } catch (exception) {
      console.error(exception);
      setTimeout(() => {wsConnect()}, timeoutReconnect);
    }
  }
}

var dispatchMessages = function(jsonData) {
  if (typeof jsonData.updates === 'object') {
    jsonData.updates.forEach((update) => {
      if (typeof update.values === 'object') {
        update.values.forEach((value) => {
          if (value.path === "steering.autopilot.state") {
            clearTimeout(handlePilotStatusTimeout);
            handlePilotStatusTimeout = setTimeout(() => {setPilotStatus('---')}, timeoutValue);
            setPilotStatus(value.value);
          } else if (value.path === "navigation.headingMagnetic") {
            clearTimeout(handleHeadindValueTimeout);
            handleHeadindValueTimeout = setTimeout(() => {setHeadindValue('---')}, timeoutValue);
            setHeadindValue(Math.round(value.value * (180/Math.PI)));
          }
        });
      }
    });
  }
}

var setHeadindValue = function(value) {
  if (typeof value !== 'undefined') {
    value = (isNaN(value)) ? '---' : 'Mag:' + value + '&deg;';
  } else {
    value = '???';
  }
  headingValueDiv.innerHTML = value;
}

var setPilotStatus = function(value) {
  pilotStatusDiv.innerHTML = value || '???';
}

var wsOpenClose = function() {
  if (connected === false) {
    wsConnect();
  } else {
      reconnect = false;
      document.getElementById("powerIcon").style.visibility = 'visible';
      if (ws !== null) {
        ws.close();
      }
    }
}
