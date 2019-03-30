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
const noDataMessage = 'NO DATA';
var pilotStatusDiv = 'undefined';
var headingValueDiv = 'undefined';
var receiveIconDiv = 'undefined';
var sendIconDiv = 'undefined';
var errorIconDiv = 'undefined';
var powerOnIconDiv = 'undefined';
var powerOffIconDiv = 'undefined';
var bottomBarIconDiv = 'undefined';

var startUpRayRemote = function() {
  pilotStatusDiv = document.getElementById('pilotStatus');
  headingValueDiv = document.getElementById('headingValue');
  receiveIconDiv = document.getElementById('receiveIcon');
  sendIconDiv = document.getElementById('sendIcon');
  errorIconDiv = document.getElementById('errorIcon');
  powerOnIconDiv = document.getElementById('powerOnIcon');
  powerOffIconDiv = document.getElementById('powerOffIcon');
  bottomBarIconDiv = document.getElementById('bottomBarIcon');

  setPilotStatus(noDataMessage);
  setHeadindValue(noDataMessage);
  setTimeout(() => {
    receiveIconDiv.style.visibility = 'hidden';
    sendIconDiv.style.visibility = 'hidden';
    errorIconDiv.style.visibility = 'hidden';
    bottomBarIconDiv.style.visibility = 'hidden';
    wsConnect();
  }, 1000);
}

var sendCommand = function(cmd) {
  errorIconDiv.style.visibility = 'hidden';
  sendIconDiv.style.visibility = 'visible';
  window.fetch('/plugins/raymarineautopilot/command', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: commands[cmd],
  }).then(function(response) {
      setTimeout(() => {sendIconDiv.style.visibility = 'hidden';}, timeoutBlink);
      if (response.status !== 200) {
        errorIconDiv.style.visibility = 'visible';
        if (response.status === 401) {
          alert('You must be authenticated to send commands !')
        } else {
          errorIconDiv.style.visibility = 'visible';
          alert('[' + response.status + ']' + response.text)
        }
      }
    }, function(status) {
        sendIconDiv.style.visibility = 'hidden';
        errorIconDiv.style.visibility = 'visible';
        alert(status.message)
    }
  );
  reconnect = true;
  wsConnect();
}

var sendMute = function() {
  bottomBarIconDiv.style.visibility = 'visible';
  bottomBarIconDiv.innerHTML = '&nbsp;Not implemented...'
  setTimeout(() => {bottomBarIconDiv.style.visibility = 'hidden';}, 2000);
}

var wsConnect = function() {
  if (ws === null) {
    try {
      reconnect = true;
      ws = new WebSocket((window.location.protocol === 'https:' ? 'wss' : 'ws') + "://" + window.location.host + "/signalk/v1/stream?subscribe=none");

      ws.onopen = function() {
        connected = true;
        powerOffIconDiv.style.visibility = 'hidden';
        powerOnIconDiv.style.visibility = 'visible';
        errorIconDiv.style.visibility = 'hidden';
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
        handlePilotStatusTimeout = setTimeout(() => {setPilotStatus(noDataMessage)}, timeoutValue);
        handleHeadindValueTimeout = setTimeout(() => {setHeadindValue(noDataMessage)}, timeoutValue);
      }

      ws.onclose = function() {
        cleanOnClosed();
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, timeoutReconnect);
        }
      }

      ws.onerror = function() {
        console.log("ws error");
        cleanOnClosed();
        errorIconDiv.style.visibility = 'visible';
        if (reconnect === true) {
          setTimeout(() => {wsConnect()}, timeoutReconnect);
        }
      }

      ws.onmessage = function(event) {
        receiveIconDiv.style.visibility = 'visible';
        clearTimeout(handleReceiveTimeout);
        handleReceiveTimeout = setTimeout(() => {receiveIconDiv.style.visibility = 'hidden';}, timeoutBlink);
        var jsonData = JSON.parse(event.data)
        dispatchMessages(jsonData);
      }

    } catch (exception) {
      console.error(exception);
      cleanOnClosed();
      errorIconDiv.style.visibility = 'visible';
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
            handlePilotStatusTimeout = setTimeout(() => {setPilotStatus(noDataMessage)}, timeoutValue);
            setPilotStatus(value.value);
          } else if (value.path === "navigation.headingMagnetic") {
            clearTimeout(handleHeadindValueTimeout);
            handleHeadindValueTimeout = setTimeout(() => {setHeadindValue(noDataMessage)}, timeoutValue);
            setHeadindValue(Math.round(value.value * (180/Math.PI)));
          }
        });
      }
    });
  }
}

var setHeadindValue = function(value) {
  if (value !== '') {
    value = ((typeof value === 'undefined') || isNaN(value)) ? noDataMessage : 'Mag:' + value + '&deg;';
  }
  headingValueDiv.innerHTML = value;
}

var setPilotStatus = function(value) {
  if (typeof value === 'undefined') {
    value = noDataMessage;
  }
  pilotStatusDiv.innerHTML = value;
}

var wsOpenClose = function() {
  if (connected === false) {
    wsConnect();
  } else {
      reconnect = false;
      if (ws !== null) {
        ws.close();
      }
      cleanOnClosed();
    }
}

var cleanOnClosed = function() {
  ws = null;
  connected = false;
  powerOffIconDiv.style.visibility = 'visible';
  powerOnIconDiv.style.visibility = 'hidden';
  bottomBarIconDiv.style.visibility = 'hidden';
  clearTimeout(handleHeadindValueTimeout);
  clearTimeout(handlePilotStatusTimeout);
  setPilotStatus('');
  setHeadindValue('');
}
