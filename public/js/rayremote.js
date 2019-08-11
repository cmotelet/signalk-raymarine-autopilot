/*
 * Copyright 2019 Christian MOTELET <cmotelet@motelet.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

var notificationsArray = {};

var touchEnd = function(event) {
  event.currentTarget.onclick();
  event.preventDefault(true);
}

var ws = null;
var handlePilotStatusTimeout = null;
var handleHeadindValueTimeout = null;
var handleReceiveTimeout = null;
var handleSilenceScreenTimeout = null;
var handleConfirmTackTimeout = null;
var handleCountDownCounterTimeout = null;
var connected = false;
var reconnect = true;
const timeoutReconnect = 2000;
const timeoutValue = 3000;
const timeoutBlink = 500;
//const noDataMessage = 'NO DATA';
const noDataMessage = '-- -- -- --';
var pilotStatusDiv = undefined;
var headingValueDiv = undefined;
var receiveIconDiv = undefined;
var sendIconDiv = undefined;
var typeValIconDiv = undefined;
var errorIconDiv = undefined;
var countDownCounterDiv = undefined;
var powerOnIconDiv = undefined;
var powerOffIconDiv = undefined;
var bottomBarIconDiv = undefined;
var notificationCounterDiv = undefined;
var notificationCounterTextDiv = undefined;
var silenceScreenDiv = undefined;
var silenceScreenText = undefined;
var tackScreenDiv = undefined;
var skPathToAck = '';
var tackConfirmed = false;
var countDownValue = 0;
var pilotStatus = '';
var preferedDisplayMode = {};

var displayByPathParams = {
  'navigation.headingMagnetic': {
    handleTimeout: null,
    typeVal: 'Mag',
    usage: ['wind', 'route', 'auto', 'standby'],
    value: ''
  },
  'navigation.headingTrue': {
    handleTimeout: null,
    typeVal: 'True',
    usage: ['wind', 'route', 'auto', 'standby'],
    value: ''
  },
  'environment.wind.angleApparent': {
    handleTimeout: null,
    typeVal: 'AWA',
    usage: ['wind'],
    value: ''
  },
  'environment.wind.angleTrueWater': {
    handleTimeout: null,
    typeVal: 'TWA',
    usage: ['wind'],
    value: ''
  }
}

var defaultPreferedDisplayMode = {
  wind: 'environment.wind.angleApparent',
  route: 'navigation.headingMagnetic',
  auto: 'navigation.headingMagnetic',
  standby: 'navigation.headingMagnetic'
}

var startUpRayRemote = function() {
  pilotStatusDiv = document.getElementById('pilotStatus');
  headingValueDiv = document.getElementById('headingValue');
  receiveIconDiv = document.getElementById('receiveIcon');
  sendIconDiv = document.getElementById('sendIcon');
  typeValIconDiv = document.getElementById('typeValIcon');
  errorIconDiv = document.getElementById('errorIcon');
  powerOnIconDiv = document.getElementById('powerOnIcon');
  powerOffIconDiv = document.getElementById('powerOffIcon');
  bottomBarIconDiv = document.getElementById('bottomBarIcon');
  notificationCounterDiv = document.getElementById('notificationCounter');
  notificationCounterTextDiv = document.getElementById('notificationCounterText');
  silenceScreenDiv = document.getElementById('silenceScreen');
  silenceScreenTextDiv = document.getElementById('silenceScreenText');
  tackScreenDiv = document.getElementById('tackScreen');
  countDownCounterDiv = document.getElementById('countDownCounter');
  setPilotStatus('');
  setHeadindValue('');
//  demo(); return;
  var savedPreferedDisplayModeJSON = localStorage.getItem('signalk-raymarine-autopilot');
  var savedPreferedDisplayMode = savedPreferedDisplayModeJSON && JSON.parse(savedPreferedDisplayModeJSON);
  if (savedPreferedDisplayMode === null) {savedPreferedDisplayMode = {};}
  savedPreferedDisplayMode = (typeof savedPreferedDisplayMode.preferedDisplayMode !== 'undefined') ? savedPreferedDisplayMode.preferedDisplayMode : {};
  for (let [key, value] of Object.entries(defaultPreferedDisplayMode)) {
    if (typeof savedPreferedDisplayMode[key] === 'undefined') {
      preferedDisplayMode[key] = value;
      continue;
    }
    if ( !displayByPathParams[savedPreferedDisplayMode[key]].usage.includes(key)) {
      preferedDisplayMode[key] = value;
      continue;
    }
    preferedDisplayMode[key] = savedPreferedDisplayMode[key];
  }
  localStorage.setItem('signalk-raymarine-autopilot', JSON.stringify({preferedDisplayMode: preferedDisplayMode}));
  setTimeout(() => {
    receiveIconDiv.style.visibility = 'hidden';
    sendIconDiv.style.visibility = 'hidden';
    errorIconDiv.style.visibility = 'hidden';
    bottomBarIconDiv.style.visibility = 'hidden';
    notificationCounterDiv.style.visibility = 'hidden';
    countDownCounterDiv.innerHTML = '';
    typeValIconDiv.innerHTML = '';
    wsConnect();
  }, 1500);
}

var demo = function () {
  setHeadindValue(100);
  setPilotStatus('wind');
  setNotificationMessage({"path":"notifications.autopilot.PilotWarningWindShift","value":{"state":"alarm","message":"Pilot Warning Wind Shift"}});
  powerOffIconDiv.style.visibility = 'hidden';
  powerOnIconDiv.style.visibility = 'visible';
  countDownCounterDiv.innerHTML = '5';
}

var buildAndSendCommand = function(cmd) {
  var cmdJson = commands[cmd];
  if (((cmd === 'tackToPort')||(cmd === 'tackToStarboard')) && (tackConfirmed === false)) {
    confirmTack(cmd);
    return null;
  }
  if (typeof cmdJson !== 'undefined') {
    if ((cmd === 'tackToPort')||(cmd === 'tackToStarboard')) {
      countDownValue = 0;
      updateCountDownCounter();
      sendCommand(commands['auto']);
    }
    sendCommand(cmdJson);
  } else {
      alert('Unknown command !')
    }
  if (tackConfirmed) {
    clearTimeout(handleConfirmTackTimeout);
    tackScreenDiv.style.visibility = 'hidden';
    tackScreenDiv.innerHTML = '';
    tackConfirmed = false;
  }
}

var sendCommand = function(cmdJson) {
  errorIconDiv.style.visibility = 'hidden';
  sendIconDiv.style.visibility = 'visible';
  window.fetch('/plugins/raymarineautopilot/command', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: cmdJson,
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

var notificationToValue = function (skPathToAck) {
  var message = notificationsArray[skPathToAck];
  if (typeof message === 'undefined') {
    message = 'No current alarm...';
  }
  return message;
}

var sendSilence = function() {
  if (silenceScreenDiv.style.visibility !== 'visible') {
    silenceScreenDiv.style.visibility = 'visible';
    autoHhideSilenceScreen();
    if ((Object.keys(notificationsArray).length > 0) && (skPathToAck === '')) {
      skPathToAck = Object.keys(notificationsArray)[0];
    }
  } else {
      if (skPathToAck !== '') {
        sendCommand('{"action":"silenceAlarm","value":{"signalkPath":"' + skPathToAck + '"}}');
      }
      countDownValue = 0;
      updateCountDownCounter();
      silenceScreenDiv.style.visibility = 'hidden';
    }
  silenceScreenTextDiv.innerHTML = notificationToValue(skPathToAck);
}

var notificationScroll = function() {
  autoHhideSilenceScreen();
  if (silenceScreenDiv.style.visibility !== 'visible') {
    silenceScreenDiv.style.visibility = 'visible';
    if ((Object.keys(notificationsArray).length > 0) && (skPathToAck === '')) {
      skPathToAck = Object.keys(notificationsArray)[0];
    }
  } else {
      skPathToAck = getNextNotification(skPathToAck);
    }
  silenceScreenTextDiv.innerHTML = notificationToValue(skPathToAck);
}

var autoHhideSilenceScreen = function() {
  countDownValue = 5;
  updateCountDownCounter();
  clearTimeout(handleSilenceScreenTimeout);
  handleSilenceScreenTimeout = setTimeout(() => {
    silenceScreenDiv.style.visibility = 'hidden';
    countDownValue = 0;
    updateCountDownCounter();
  }, 5000);
}

var getNextNotification = function(skPath) {
  var notificationsKeys = Object.keys(notificationsArray);
  var newSkPathToAck = '';
  var index;
  if (notificationsKeys.length > 0) {
    if (typeof skPath !== 'undefined') {
      index = notificationsKeys.indexOf(skPath) + 1;
    } else {
        index = 0;
      }
    if (notificationsKeys.length <= index) {
      index = 0;
    }
    newSkPathToAck = notificationsKeys[index];
  }
  return newSkPathToAck;
}

var changePreferedDisplayMode = function() {
  const currentPilotStatus = pilotStatus;
  const currentPreferedDisplayMode = preferedDisplayMode[currentPilotStatus];
  var pathForPilotStatus = [];
  if (typeof currentPreferedDisplayMode === 'undefined') {return null}
  for (let [key, value] of Object.entries(displayByPathParams)) {
   if ((typeof value.usage === 'object') && value.usage.includes(currentPilotStatus)) {
     pathForPilotStatus.push(key);
   }
  }
  const currentIndex = pathForPilotStatus.indexOf(currentPreferedDisplayMode);
  const nextIndex = (currentIndex + 1) % pathForPilotStatus.length;
  preferedDisplayMode[currentPilotStatus] = pathForPilotStatus[nextIndex];
  localStorage.setItem('signalk-raymarine-autopilot', JSON.stringify({preferedDisplayMode: preferedDisplayMode}));
  setHeadindValue(displayByPathParams[preferedDisplayMode[currentPilotStatus]].value);
  typeValIconDiv.innerHTML = displayByPathParams[preferedDisplayMode[currentPilotStatus]].typeVal;
}

var confirmTack = function(cmd) {
  var message = 'Repeat same key<br>to confirm<br>tack to ';
  tackConfirmed = true;
  if (cmd === 'tackToPort') {
    message += 'port';
  } else if (cmd === 'tackToStarboard') {
      message += 'starboard';
    } else {
        tackConfirmed = false;
        return null;
      }
  countDownValue = 5;
  updateCountDownCounter();
  tackScreenDiv.innerHTML = '<p>' + message + '</p>';
  tackScreenDiv.style.visibility = 'visible';
  clearTimeout(handleConfirmTackTimeout);
  handleConfirmTackTimeout = setTimeout(() => {
    tackScreenDiv.style.visibility = 'hidden';
    tackScreenDiv.innerHTML = '';
    tackConfirmed = false;
  }, 5000);

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
            },
            {
              "path": "navigation.headingTrue",
              "format": "delta",
              "minPeriod": 900
            },
            {
              "path": "environment.wind.angleApparent",
              "format": "delta",
              "minPeriod": 900
            },
            {
              "path": "environment.wind.angleTrueWater",
              "format": "delta",
              "minPeriod": 900
            },
            {
              "path": "notifications.autopilot.*",
              "format": "delta",
              "minPeriod": 200
            }
          ]
        };
        var subscriptionMessage = JSON.stringify(subscriptionObject);
        ws.send(subscriptionMessage);
        handlePilotStatusTimeout = setTimeout(() => {setPilotStatus('')}, timeoutValue);
        handleHeadindValueTimeout = setTimeout(() => {setHeadindValue('')}, timeoutValue);
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
            handlePilotStatusTimeout = setTimeout(() => {
              console.log('timeout:'+pilotStatus);
              setPilotStatus('');
            }, timeoutValue);
            setPilotStatus(value.value);
          } else if (value.path.startsWith("notifications.autopilot")) {
            setNotificationMessage(value);
          } else {
            buildHeadindValue(value.path, value.value);
          }
        });
      }
    });
  }
}

var buildHeadindValue = function(path, value) {
  var displayByPathParam = displayByPathParams[path];

  if (typeof displayByPathParam === 'undefined') {
    console.log('unknown path:' + path);
    return null;
  }

  value = Math.round(value * (180/Math.PI));
  displayByPathParam.value = ((typeof value === 'undefined') || isNaN(value)) ? noDataMessage : ' ' + value + '&deg;';
  clearTimeout(displayByPathParam.handleTimeout);
  displayByPathParam.handleTimeout = setTimeout(() => {
    displayByPathParams[path].value = noDataMessage;
    console.log('timeout:{'+pilotStatus+'}['+path+']'+displayByPathParams[path].value);
    if (preferedDisplayMode[pilotStatus] == path) {
      setHeadindValue(displayByPathParams[path].value);
    }
  }, timeoutValue, path);
  if (preferedDisplayMode[pilotStatus] == path) {
    if (typeValIconDiv.innerHTML !== displayByPathParam.typeVal) {
      typeValIconDiv.innerHTML = displayByPathParam.typeVal;
    }
    setHeadindValue(displayByPathParams[path].value);
  }
}

var setHeadindValue = function(value) {
  if (pilotStatus === '') { value = ''}
  headingValueDiv.innerHTML = ((typeof value === 'undefined') || (value === '')) ? noDataMessage : value;
}

var setPilotStatus = function(value) {
  if (typeof value === 'undefined') {
    value = '';
  }
  pilotStatus = value;
  if (value === '') {
    value = noDataMessage;
    setHeadindValue(value);
  }
  pilotStatusDiv.innerHTML = value;
}

var setNotificationMessage = function(value) {
  if (typeof value.path !== 'undefined') {
    value.path = value.path.replace('notifications.', '');
    if (typeof value.value !== 'undefined') {
      if (value.value.state === 'normal') {
        delete notificationsArray[value.path]
      } else {
          notificationsArray[value.path] = value.value.message.replace('Pilot', '');
          bottomBarIconDiv.style.visibility = 'visible';
          bottomBarIconDiv.innerHTML = notificationsArray[value.path];
        }
    }
  }
  var alarmsCount = Object.keys(notificationsArray).length;
  if (alarmsCount > 0) {
    notificationCounterTextDiv.innerHTML = alarmsCount;
    notificationCounterDiv.style.visibility = 'visible';
  } else {
      notificationCounterTextDiv.innerHTML = '';
      notificationCounterDiv.style.visibility = 'hidden';
    }
}

var displayHelp = function() {
  bottomBarIconDiv.style.visibility = 'visible';
  bottomBarIconDiv.innerHTML = '&nbsp;Not yet implemented...'
  setTimeout(() => {bottomBarIconDiv.style.visibility = 'hidden';}, 2000);
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
  receiveIconDiv.style.visibility = 'hidden';
  sendIconDiv.style.visibility = 'hidden';
  errorIconDiv.style.visibility = 'hidden';
  bottomBarIconDiv.style.visibility = 'hidden';
  notificationCounterDiv.style.visibility = 'hidden';
  powerOffIconDiv.style.visibility = 'visible';
  powerOnIconDiv.style.visibility = 'hidden';
  notificationCounterDiv.style.visibility = 'hidden';
  silenceScreenDiv.style.visibility = 'hidden';
  notificationCounterTextDiv.innerHTML = '';
  typeValIconDiv.innerHTML = '';
  notificationsArray = {};
  skPathToAck = '';
  tackConfirmed = false;
  clearTimeout(handleHeadindValueTimeout);
  clearTimeout(handlePilotStatusTimeout);
  setPilotStatus('');
  setHeadindValue('');
}

var updateCountDownCounter = function() {
  if (countDownValue > 0) {
    clearTimeout(handleCountDownCounterTimeout);
    countDownCounterDiv.innerHTML = countDownValue;
    countDownValue -= 1;
    handleCountDownCounterTimeout = setTimeout(() => {
      updateCountDownCounter();
    }, 1000);
  } else {
      clearTimeout(handleCountDownCounterTimeout);
      countDownCounterDiv.innerHTML = '';
    }
}
