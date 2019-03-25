const commands = {
  "auto":    '{"action":"setState","value":"auto"}',
  "wind":    '{"action":"setState","value":"wind"}',
  "route":   '{"action":"setState","value":"route"}',
  "standby": '{"action":"setState","value":"standby"}',
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
