const commands = {
  "auto":    '{"action":"setState","value":"auto"}',
  "wind":    '{"action":"setState","value":"wind"}',
  "route":   '{"action":"setState","value":"route"}',
  "standby": '{"action":"setState","value":"standby"}',
  "track":   '{"action":"setState","value":"track"}',
  "+1":      '{"action":"setKey","value":"+1"}',
  "+10":     '{"action":"setKey","value":"+10"}',
  "-1":      '{"action":"setKey","value":"-1"}',
  "-10":     '{"action":"setKey","value":"-10"}',
  "-1-10":   '{"action":"setKey","value":"-1-10"}',
  "+1+10":   '{"action":"setKey","value":"+1+10"}'
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
  }).then(function(data) {
      setTimeout(function(){document.getElementById("sendIcon").style.visibility = 'hidden';}, 800);
    }, function(status) {
        document.getElementById("sendIcon").style.visibility = 'hidden';
        document.getElementById("errorIcon").style.visibility = 'visible';
    }
  );
}
